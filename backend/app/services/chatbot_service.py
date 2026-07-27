import asyncio
import base64
import logging
import os
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO
from typing import Optional

from openai import AsyncOpenAI
from agents import Agent, Runner, function_tool, RunContextWrapper
from sqlalchemy import cast, func, select
from sqlalchemy import Date as SADate
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chart_of_account import ChartOfAccount
from app.models.journal_entry import JournalEntry, JournalEntryLine
from app.models.medicine import Medicine
from app.models.sale import Sale
from app.models.sale_item import SaleItem

logger = logging.getLogger(__name__)

AGENT_TIMEOUT_SECONDS = 60
LOW_STOCK_THRESHOLD = 10

_openai_client: AsyncOpenAI | None = None

def _get_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY environment variable is not set")
        _openai_client = AsyncOpenAI(api_key=key)
    return _openai_client


@dataclass
class PharmacyContext:
    user_id: int
    db: AsyncSession


def _parse_date_range(date_range: str) -> tuple[date, date]:
    today = date.today()
    dr = date_range.lower().strip()
    if dr in ("today", ""):
        return today, today
    if dr == "this week":
        return today - timedelta(days=today.weekday()), today
    if dr == "this month":
        return today.replace(day=1), today
    if dr == "last month":
        first_this = today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        return last_prev.replace(day=1), last_prev
    if dr == "this year":
        return today.replace(month=1, day=1), today
    try:
        if " to " in dr:
            a, b = dr.split(" to ", 1)
            return date.fromisoformat(a.strip()), date.fromisoformat(b.strip())
        d = date.fromisoformat(dr)
        return d, d
    except ValueError:
        return today, today


@function_tool
async def get_sales_summary(ctx: RunContextWrapper[PharmacyContext], date_range: str) -> str:
    """Get total sales amount and transaction count for a time period (today, this week, this month, last month, this year, or YYYY-MM-DD)."""
    db = ctx.context.db
    user_id = ctx.context.user_id
    start, end = _parse_date_range(date_range)
    logger.info("tool=get_sales_summary user=%s range=%s/%s", user_id, start, end)

    row = (await db.execute(
        select(
            func.count(Sale.id).label("cnt"),
            func.coalesce(func.sum(Sale.total_amount), 0).label("total"),
        ).where(
            cast(Sale.created_at, SADate) >= start,
            cast(Sale.created_at, SADate) <= end,
        )
    )).one()

    count, total = row.cnt, Decimal(str(row.total))
    if count == 0:
        return f"No sales found for {date_range}."
    return f"Sales for {date_range}: Rs. {total:,.2f} from {count} transaction{'s' if count != 1 else ''}."


@function_tool
async def get_expenses_summary(ctx: RunContextWrapper[PharmacyContext], date_range: str) -> str:
    """Get total expenses broken down by account for a time period."""
    db = ctx.context.db
    user_id = ctx.context.user_id
    start, end = _parse_date_range(date_range)
    logger.info("tool=get_expenses_summary user=%s range=%s/%s", user_id, start, end)

    rows = (await db.execute(
        select(
            ChartOfAccount.account_name,
            func.coalesce(func.sum(JournalEntryLine.debit_amount), 0).label("total"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .where(
            ChartOfAccount.account_type == "expense",
            JournalEntry.entry_date >= start,
            JournalEntry.entry_date <= end,
        )
        .group_by(ChartOfAccount.account_name)
        .having(func.sum(JournalEntryLine.debit_amount) > 0)
        .order_by(func.sum(JournalEntryLine.debit_amount).desc())
    )).all()

    if not rows:
        return f"No expenses recorded for {date_range}."

    grand = sum(Decimal(str(r.total)) for r in rows)
    lines = [f"  {r.account_name}: Rs. {Decimal(str(r.total)):,.2f}" for r in rows]
    return f"Expenses for {date_range}: Rs. {grand:,.2f} total\n" + "\n".join(lines)


@function_tool
async def get_account_balance(ctx: RunContextWrapper[PharmacyContext], account_name: str) -> str:
    """Get the current running balance of an account, matched by name (fuzzy — spoken input is fine)."""
    db = ctx.context.db
    user_id = ctx.context.user_id
    logger.info("tool=get_account_balance user=%s account=%r", user_id, account_name)

    account = (await db.execute(
        select(ChartOfAccount).where(
            ChartOfAccount.account_name.ilike(f"%{account_name}%"),
            ChartOfAccount.is_active == True,  # noqa: E712
        ).limit(1)
    )).scalar_one_or_none()

    if not account:
        return f"No active account found matching '{account_name}'."

    row = (await db.execute(
        select(
            func.coalesce(func.sum(JournalEntryLine.debit_amount), 0).label("td"),
            func.coalesce(func.sum(JournalEntryLine.credit_amount), 0).label("tc"),
        ).where(JournalEntryLine.account_id == account.id)
    )).one()

    td, tc = Decimal(str(row.td)), Decimal(str(row.tc))
    balance = (td - tc) if account.normal_balance == "debit" else (tc - td)
    return f"{account.account_name} ({account.account_code}): Rs. {balance:,.2f}"


@function_tool
async def get_profit_summary(ctx: RunContextWrapper[PharmacyContext], date_range: str) -> str:
    """Get net profit (revenue minus expenses) for a time period."""
    db = ctx.context.db
    user_id = ctx.context.user_id
    start, end = _parse_date_range(date_range)
    logger.info("tool=get_profit_summary user=%s range=%s/%s", user_id, start, end)

    revenue = Decimal(str((await db.execute(
        select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
            cast(Sale.created_at, SADate) >= start,
            cast(Sale.created_at, SADate) <= end,
        )
    )).scalar_one()))

    expenses = Decimal(str((await db.execute(
        select(func.coalesce(func.sum(JournalEntryLine.debit_amount), 0))
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .join(ChartOfAccount, ChartOfAccount.id == JournalEntryLine.account_id)
        .where(
            ChartOfAccount.account_type == "expense",
            JournalEntry.entry_date >= start,
            JournalEntry.entry_date <= end,
        )
    )).scalar_one()))

    profit = revenue - expenses
    sign = "profit" if profit >= 0 else "loss"
    return (
        f"Financial summary for {date_range}: "
        f"Revenue Rs. {revenue:,.2f}, "
        f"Expenses Rs. {expenses:,.2f}, "
        f"Net {sign} Rs. {abs(profit):,.2f}."
    )


@function_tool
async def get_low_stock_medicines(ctx: RunContextWrapper[PharmacyContext]) -> str:
    """Get medicines that are running low on stock."""
    db = ctx.context.db
    user_id = ctx.context.user_id
    logger.info("tool=get_low_stock_medicines user=%s", user_id)

    rows = (await db.execute(
        select(Medicine.name, Medicine.stock, Medicine.company)
        .where(Medicine.stock < LOW_STOCK_THRESHOLD, Medicine.stock >= 0)
        .order_by(Medicine.stock.asc())
        .limit(20)
    )).all()

    if not rows:
        return f"All medicines have sufficient stock (above {LOW_STOCK_THRESHOLD} units)."

    lines = [f"  {r.name}: {r.stock} units" for r in rows]
    return f"{len(rows)} medicine(s) low on stock (below {LOW_STOCK_THRESHOLD}):\n" + "\n".join(lines)


@function_tool
async def get_top_selling_medicines(
    ctx: RunContextWrapper[PharmacyContext], date_range: str, limit: int = 5
) -> str:
    """Get the top-selling medicines by quantity sold for a time period."""
    db = ctx.context.db
    user_id = ctx.context.user_id
    start, end = _parse_date_range(date_range)
    limit = max(1, min(limit, 20))
    logger.info("tool=get_top_selling_medicines user=%s range=%s/%s limit=%d", user_id, start, end, limit)

    rows = (await db.execute(
        select(
            Medicine.name,
            func.sum(SaleItem.quantity).label("qty"),
            func.sum(SaleItem.quantity * SaleItem.price).label("revenue"),
        )
        .join(SaleItem, SaleItem.medicine_id == Medicine.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(
            cast(Sale.created_at, SADate) >= start,
            cast(Sale.created_at, SADate) <= end,
        )
        .group_by(Medicine.name)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
    )).all()

    if not rows:
        return f"No sales data found for {date_range}."

    lines = [
        f"  {i+1}. {r.name}: {int(r.qty)} units sold (Rs. {Decimal(str(r.revenue)):,.2f})"
        for i, r in enumerate(rows)
    ]
    return f"Top {len(rows)} medicines for {date_range}:\n" + "\n".join(lines)


_AGENT: Agent[PharmacyContext] = Agent(
    name="Pharmacy Business Assistant",
    model="gpt-4o-mini",
    instructions=(
        "You are a concise pharmacy business assistant. "
        "Answer questions about sales, expenses, profit, inventory, and account balances using your tools. "
        "Always state amounts in Pakistani Rupees (Rs.). "
        "Keep answers short and conversational — they will be read aloud. "
        "Do not use markdown, bullet symbols, or formatting characters. "
        "IMPORTANT: Always respond in English only, regardless of what language the user speaks in. "
        "If asked something outside pharmacy business data, politely say you can only help with business queries."
    ),
    tools=[
        get_sales_summary,
        get_expenses_summary,
        get_account_balance,
        get_profit_summary,
        get_low_stock_medicines,
        get_top_selling_medicines,
    ],
)


@dataclass
class PipelineResult:
    transcript: str
    response_text: str
    audio_base64: str

# Legacy alias
VoicePipelineResult = PipelineResult


async def run_voice_pipeline(
    audio_bytes: bytes,
    user_id: int,
    db: AsyncSession,
) -> VoicePipelineResult:
    client = _get_client()

    # STT — Whisper
    buf = BytesIO(audio_bytes)
    buf.name = "audio.webm"
    transcription = await client.audio.transcriptions.create(model="whisper-1", file=buf)
    transcript = transcription.text.strip()
    logger.info("STT user=%s transcript=%r", user_id, transcript[:100])

    if not transcript:
        response_text = "I could not hear anything. Please try speaking again."
    else:
        context = PharmacyContext(user_id=user_id, db=db)
        result = await asyncio.wait_for(
            Runner.run(_AGENT, transcript, context=context),
            timeout=AGENT_TIMEOUT_SECONDS,
        )
        response_text = result.final_output

    logger.info("TTS user=%s response=%r", user_id, response_text[:100])

    # TTS — OpenAI speech
    tts_resp = await client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input=response_text,
        response_format="mp3",
    )
    audio_b64 = base64.b64encode(tts_resp.content).decode()

    return PipelineResult(
        transcript=transcript,
        response_text=response_text,
        audio_base64=audio_b64,
    )


async def run_text_pipeline(
    message: str,
    user_id: int,
    db: AsyncSession,
) -> PipelineResult:
    client = _get_client()
    logger.info("TEXT user=%s message=%r", user_id, message[:100])

    context = PharmacyContext(user_id=user_id, db=db)
    result = await asyncio.wait_for(
        Runner.run(_AGENT, message, context=context),
        timeout=AGENT_TIMEOUT_SECONDS,
    )
    response_text = result.final_output
    logger.info("TTS user=%s response=%r", user_id, response_text[:100])

    tts_resp = await client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input=response_text,
        response_format="mp3",
    )
    audio_b64 = base64.b64encode(tts_resp.content).decode()

    return PipelineResult(
        transcript=message,
        response_text=response_text,
        audio_base64=audio_b64,
    )
