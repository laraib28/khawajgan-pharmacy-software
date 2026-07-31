import asyncio
import base64
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / '.env')
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

_PKT = ZoneInfo("Asia/Karachi")
from decimal import Decimal
from io import BytesIO

from openai import AsyncOpenAI
from agents import Agent, Runner, function_tool, RunContextWrapper
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chart_of_account import ChartOfAccount
from app.models.journal_entry import JournalEntry, JournalEntryLine
from app.models.medicine import Medicine
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.stock_receiving import StockReceiving

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
    today = datetime.now(_PKT).date()
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


# ── Financial tools ───────────────────────────────────────────────────────────

@function_tool
async def get_sales_summary(ctx: RunContextWrapper[PharmacyContext], date_range: str) -> str:
    """Get total sales amount and transaction count for a time period (today, this week, this month, last month, this year, or YYYY-MM-DD)."""
    db = ctx.context.db
    start, end = _parse_date_range(date_range)
    logger.info("tool=get_sales_summary user=%s range=%s/%s", ctx.context.user_id, start, end)

    row = (await db.execute(
        select(
            func.count(Sale.id).label("cnt"),
            func.coalesce(func.sum(Sale.total_amount), 0).label("total"),
        ).where(
            func.date(func.timezone('Asia/Karachi', Sale.created_at)) >= start,
            func.date(func.timezone('Asia/Karachi', Sale.created_at)) <= end,
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
    start, end = _parse_date_range(date_range)
    logger.info("tool=get_expenses_summary user=%s range=%s/%s", ctx.context.user_id, start, end)

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
    logger.info("tool=get_account_balance user=%s account=%r", ctx.context.user_id, account_name)

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
    start, end = _parse_date_range(date_range)
    logger.info("tool=get_profit_summary user=%s range=%s/%s", ctx.context.user_id, start, end)

    revenue = Decimal(str((await db.execute(
        select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
            func.date(func.timezone('Asia/Karachi', Sale.created_at)) >= start,
            func.date(func.timezone('Asia/Karachi', Sale.created_at)) <= end,
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


# ── Basic inventory tools ─────────────────────────────────────────────────────

@function_tool
async def get_low_stock_medicines(ctx: RunContextWrapper[PharmacyContext]) -> str:
    """Get medicines that are running low on stock (below 10 units, excluding zero)."""
    db = ctx.context.db
    logger.info("tool=get_low_stock_medicines user=%s", ctx.context.user_id)

    rows = (await db.execute(
        select(Medicine.name, Medicine.stock, Medicine.company)
        .where(Medicine.stock < LOW_STOCK_THRESHOLD, Medicine.stock > 0)
        .order_by(Medicine.stock.asc())
        .limit(20)
    )).all()

    if not rows:
        return f"All medicines have sufficient stock (above {LOW_STOCK_THRESHOLD} units)."

    lines = [f"  {r.name}: {r.stock} units" + (f" ({r.company})" if r.company else "") for r in rows]
    return f"{len(rows)} medicine(s) low on stock (below {LOW_STOCK_THRESHOLD}):\n" + "\n".join(lines)


@function_tool
async def get_top_selling_medicines(
    ctx: RunContextWrapper[PharmacyContext], date_range: str, limit: int = 5
) -> str:
    """Get the top-selling medicines by quantity sold for a time period."""
    db = ctx.context.db
    start, end = _parse_date_range(date_range)
    limit = max(1, min(limit, 20))
    logger.info("tool=get_top_selling_medicines user=%s range=%s/%s limit=%d", ctx.context.user_id, start, end, limit)

    rows = (await db.execute(
        select(
            Medicine.name,
            func.sum(SaleItem.quantity).label("qty"),
            func.sum(SaleItem.quantity * SaleItem.price).label("revenue"),
        )
        .join(SaleItem, SaleItem.medicine_id == Medicine.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(
            func.date(func.timezone('Asia/Karachi', Sale.created_at)) >= start,
            func.date(func.timezone('Asia/Karachi', Sale.created_at)) <= end,
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


@function_tool
async def get_out_of_stock_medicines(ctx: RunContextWrapper[PharmacyContext]) -> str:
    """Get all medicines currently at zero quantity (out of stock)."""
    db = ctx.context.db
    logger.info("tool=get_out_of_stock_medicines user=%s", ctx.context.user_id)

    rows = (await db.execute(
        select(Medicine.name, Medicine.company)
        .where(Medicine.stock == 0)
        .order_by(Medicine.name)
    )).all()

    if not rows:
        return "No medicines are currently out of stock."

    lines = [
        f"  {r.name}" + (f" ({r.company})" if r.company else "")
        for r in rows
    ]
    return f"{len(rows)} medicine(s) out of stock:\n" + "\n".join(lines)


@function_tool
async def get_stock_by_company(ctx: RunContextWrapper[PharmacyContext], company_name: str) -> str:
    """Get total products and stock quantity for a specific manufacturer/company. Fuzzy match — voice transcription input is fine."""
    db = ctx.context.db
    logger.info("tool=get_stock_by_company user=%s company=%r", ctx.context.user_id, company_name)

    rows = (await db.execute(
        select(
            Medicine.company,
            func.count(Medicine.id).label("product_count"),
            func.coalesce(func.sum(Medicine.stock), 0).label("total_stock"),
        )
        .where(Medicine.company.ilike(f"%{company_name}%"))
        .group_by(Medicine.company)
        .order_by(func.count(Medicine.id).desc())
    )).all()

    if not rows:
        all_companies = (await db.execute(
            select(Medicine.company).where(Medicine.company.isnot(None)).distinct().limit(50)
        )).scalars().all()
        suggestions = [c for c in all_companies if c and any(
            w in c.lower() for w in company_name.lower().split() if len(w) > 2
        )]
        if suggestions:
            return f"No company found matching '{company_name}'. Did you mean: {', '.join(suggestions[:3])}?"
        return f"No company found matching '{company_name}'."

    lines = [
        f"  {r.company}: {r.product_count} product(s), {int(r.total_stock)} units in stock"
        for r in rows
    ]
    return f"Company stock for '{company_name}':\n" + "\n".join(lines)


@function_tool
async def get_all_companies_summary(ctx: RunContextWrapper[PharmacyContext]) -> str:
    """List all manufacturers/companies in inventory with product count and total stock quantity, sorted by product count."""
    db = ctx.context.db
    logger.info("tool=get_all_companies_summary user=%s", ctx.context.user_id)

    rows = (await db.execute(
        select(
            Medicine.company,
            func.count(Medicine.id).label("product_count"),
            func.coalesce(func.sum(Medicine.stock), 0).label("total_stock"),
        )
        .where(Medicine.company.isnot(None))
        .group_by(Medicine.company)
        .order_by(func.count(Medicine.id).desc())
    )).all()

    no_company_count = (await db.execute(
        select(func.count(Medicine.id)).where(Medicine.company.is_(None))
    )).scalar_one()

    if not rows and not no_company_count:
        return "No medicines found in inventory."

    lines = [
        f"  {r.company}: {r.product_count} product(s), {int(r.total_stock)} units total"
        for r in rows
    ]
    result = f"{len(rows)} company/companies in inventory:\n" + "\n".join(lines)
    if no_company_count:
        result += f"\n  (No company assigned): {no_company_count} product(s)"
    return result


@function_tool
async def get_slow_moving_medicines(ctx: RunContextWrapper[PharmacyContext], days: int = 30) -> str:
    """Get medicines that are in stock but have had zero sales in the last N days (default 30). Useful for identifying dead stock."""
    db = ctx.context.db
    days = max(1, min(days, 365))
    cutoff = datetime.now(_PKT).date() - timedelta(days=days)
    logger.info("tool=get_slow_moving_medicines user=%s days=%d", ctx.context.user_id, days)

    sold_subq = (
        select(SaleItem.medicine_id, func.sum(SaleItem.quantity).label("sold"))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(func.date(func.timezone('Asia/Karachi', Sale.created_at)) >= cutoff)
        .group_by(SaleItem.medicine_id)
        .subquery()
    )

    rows = (await db.execute(
        select(
            Medicine.name,
            Medicine.stock,
            Medicine.company,
            func.coalesce(sold_subq.c.sold, 0).label("sold"),
        )
        .outerjoin(sold_subq, sold_subq.c.medicine_id == Medicine.id)
        .where(Medicine.stock > 0, func.coalesce(sold_subq.c.sold, 0) == 0)
        .order_by(Medicine.stock.desc())
        .limit(25)
    )).all()

    if not rows:
        return f"All in-stock medicines have had at least some sales in the last {days} day(s)."

    lines = [
        f"  {r.name}: {r.stock} units in stock, 0 sold in {days} days"
        + (f" ({r.company})" if r.company else "")
        for r in rows
    ]
    return (
        f"{len(rows)} slow-moving medicine(s) — in stock but no sales in last {days} days:\n"
        + "\n".join(lines)
    )


# ── Full inventory tools (require new schema fields) ──────────────────────────

@function_tool
async def get_medicine_details(ctx: RunContextWrapper[PharmacyContext], medicine_name: str) -> str:
    """Get full details for a specific medicine: stock, price, cost price, company, expiry date, batch number, and units sold in last 30 days. Fuzzy match on name."""
    db = ctx.context.db
    logger.info("tool=get_medicine_details user=%s name=%r", ctx.context.user_id, medicine_name)

    med = (await db.execute(
        select(Medicine)
        .where(Medicine.name.ilike(f"%{medicine_name}%"))
        .order_by(Medicine.name)
        .limit(1)
    )).scalar_one_or_none()

    if not med:
        first_word = medicine_name.split()[0] if medicine_name.split() else medicine_name
        suggestions = (await db.execute(
            select(Medicine.name).where(Medicine.name.ilike(f"%{first_word}%")).limit(5)
        )).scalars().all()
        if suggestions:
            return f"No medicine found matching '{medicine_name}'. Did you mean: {', '.join(suggestions)}?"
        return f"No medicine found matching '{medicine_name}'."

    today = datetime.now(_PKT).date()
    sold_30 = (await db.execute(
        select(func.coalesce(func.sum(SaleItem.quantity), 0))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(
            SaleItem.medicine_id == med.id,
            func.date(func.timezone('Asia/Karachi', Sale.created_at)) >= today - timedelta(days=30),
        )
    )).scalar_one()

    parts = [
        f"Medicine: {med.name}",
        f"Stock: {med.stock} unit(s)",
        f"Selling price: Rs. {med.price:,.2f}",
    ]
    if med.cost_price is not None:
        parts.append(f"Cost price: Rs. {med.cost_price:,.2f}")
    if med.company:
        parts.append(f"Company: {med.company}")
    if med.batch_number:
        parts.append(f"Batch number: {med.batch_number}")
    if med.expiry_date:
        days_left = (med.expiry_date - today).days
        if days_left < 0:
            parts.append(f"Expiry date: {med.expiry_date} (EXPIRED {abs(days_left)} days ago)")
        elif days_left <= 90:
            parts.append(f"Expiry date: {med.expiry_date} (expires in {days_left} days — WARNING)")
        else:
            parts.append(f"Expiry date: {med.expiry_date}")
    else:
        parts.append("Expiry date: not recorded")
    if med.composition:
        parts.append(f"Composition: {med.composition}")
    if med.type:
        parts.append(f"Type: {med.type}")
    parts.append(f"Sold in last 30 days: {int(sold_30)} unit(s)")
    return "\n".join(parts)


@function_tool
async def get_expiring_medicines(ctx: RunContextWrapper[PharmacyContext], days_threshold: int = 90) -> str:
    """Get medicines expiring within a given number of days (default 90), sorted by soonest expiry. Only includes medicines where expiry date is recorded."""
    db = ctx.context.db
    days_threshold = max(1, min(days_threshold, 730))
    today = datetime.now(_PKT).date()
    cutoff = today + timedelta(days=days_threshold)
    logger.info("tool=get_expiring_medicines user=%s days=%d", ctx.context.user_id, days_threshold)

    rows = (await db.execute(
        select(Medicine.name, Medicine.stock, Medicine.company, Medicine.expiry_date, Medicine.batch_number)
        .where(
            Medicine.expiry_date.isnot(None),
            Medicine.expiry_date >= today,
            Medicine.expiry_date <= cutoff,
            Medicine.stock > 0,
        )
        .order_by(Medicine.expiry_date.asc())
        .limit(30)
    )).all()

    total_with_expiry = (await db.execute(
        select(func.count(Medicine.id)).where(Medicine.expiry_date.isnot(None))
    )).scalar_one()

    if not rows:
        note = f" ({total_with_expiry} medicine(s) have expiry dates recorded)" if total_with_expiry else " (no expiry dates are recorded yet — enter them in the Inventory page)"
        return f"No medicines expiring within {days_threshold} days.{note}"

    lines = []
    for r in rows:
        days_left = (r.expiry_date - today).days
        batch_str = f", batch {r.batch_number}" if r.batch_number else ""
        company_str = f" ({r.company})" if r.company else ""
        lines.append(f"  {r.name}{company_str}: expires {r.expiry_date} ({days_left} days){batch_str}, {r.stock} units in stock")

    return f"{len(rows)} medicine(s) expiring within {days_threshold} days:\n" + "\n".join(lines)


@function_tool
async def get_expired_medicines(ctx: RunContextWrapper[PharmacyContext]) -> str:
    """Get medicines already past their expiry date that are still in stock, so the owner knows what needs to be pulled."""
    db = ctx.context.db
    today = datetime.now(_PKT).date()
    logger.info("tool=get_expired_medicines user=%s", ctx.context.user_id)

    rows = (await db.execute(
        select(Medicine.name, Medicine.stock, Medicine.company, Medicine.expiry_date, Medicine.batch_number)
        .where(
            Medicine.expiry_date.isnot(None),
            Medicine.expiry_date < today,
            Medicine.stock > 0,
        )
        .order_by(Medicine.expiry_date.asc())
        .limit(50)
    )).all()

    if not rows:
        return "No expired medicines found in stock. (Only medicines with expiry dates recorded are checked.)"

    lines = []
    for r in rows:
        days_ago = (today - r.expiry_date).days
        batch_str = f", batch {r.batch_number}" if r.batch_number else ""
        company_str = f" ({r.company})" if r.company else ""
        lines.append(f"  {r.name}{company_str}: expired {r.expiry_date} ({days_ago} days ago){batch_str}, {r.stock} units still in stock")

    return (
        f"WARNING: {len(rows)} expired medicine(s) still in stock — these should be pulled immediately:\n"
        + "\n".join(lines)
    )


@function_tool
async def get_stock_value_summary(ctx: RunContextWrapper[PharmacyContext]) -> str:
    """Get inventory value summary: true cost value (stock × cost price) and potential revenue value (stock × selling price), broken down by company."""
    db = ctx.context.db
    logger.info("tool=get_stock_value_summary user=%s", ctx.context.user_id)

    rows = (await db.execute(
        select(
            Medicine.company,
            func.count(Medicine.id).label("products"),
            func.coalesce(
                func.sum(
                    func.case((Medicine.cost_price.isnot(None), Medicine.stock * Medicine.cost_price), else_=None)
                ), 0
            ).label("cost_value"),
            func.coalesce(func.sum(Medicine.stock * Medicine.price), 0).label("sell_value"),
            func.count(
                func.case((Medicine.cost_price.isnot(None), 1), else_=None)
            ).label("has_cost_count"),
        )
        .group_by(Medicine.company)
        .order_by(func.sum(Medicine.stock * Medicine.price).desc())
    )).all()

    if not rows:
        return "No medicines found in inventory."

    total_cost = sum(Decimal(str(r.cost_value or 0)) for r in rows)
    total_sell = sum(Decimal(str(r.sell_value or 0)) for r in rows)
    total_with_cost = sum(int(r.has_cost_count) for r in rows)
    total_products = sum(int(r.products) for r in rows)

    lines = []
    for r in rows:
        company = r.company or "No company"
        cost_str = f"Rs. {Decimal(str(r.cost_value or 0)):,.2f}" if int(r.has_cost_count) > 0 else "cost not recorded"
        lines.append(
            f"  {company}: cost {cost_str}, sell value Rs. {Decimal(str(r.sell_value or 0)):,.2f} ({r.products} product(s))"
        )

    result = (
        f"Inventory value summary ({total_products} products total):\n"
        f"  True cost value: Rs. {total_cost:,.2f} ({total_with_cost}/{total_products} products have cost price)\n"
        f"  Potential revenue: Rs. {total_sell:,.2f} (at selling prices)\n"
        "By company:\n" + "\n".join(lines)
    )
    if total_with_cost < total_products:
        result += f"\n  Note: {total_products - total_with_cost} product(s) have no cost price recorded — enter them in Inventory for accurate cost."
    return result


@function_tool
async def get_recently_restocked(ctx: RunContextWrapper[PharmacyContext], days: int = 7) -> str:
    """Get medicines received and restocked in the last N days (default 7), including supplier name if recorded."""
    db = ctx.context.db
    days = max(1, min(days, 365))
    cutoff = datetime.now(_PKT) - timedelta(days=days)
    logger.info("tool=get_recently_restocked user=%s days=%d", ctx.context.user_id, days)

    rows = (await db.execute(
        select(
            StockReceiving.medicine_name,
            StockReceiving.quantity,
            StockReceiving.received_at,
            StockReceiving.company_invoice_no,
            StockReceiving.supplier_name,
            Medicine.company,
        )
        .join(Medicine, Medicine.id == StockReceiving.medicine_id)
        .where(StockReceiving.received_at >= cutoff)
        .order_by(StockReceiving.received_at.desc())
        .limit(30)
    )).all()

    if not rows:
        return f"No restocking activity in the last {days} day(s)."

    lines = []
    for r in rows:
        date_str = r.received_at.astimezone(_PKT).strftime("%b %d")
        supplier_str = f" from {r.supplier_name}" if r.supplier_name else ""
        company_str = f" ({r.company})" if r.company else ""
        invoice_str = f", invoice {r.company_invoice_no}" if r.company_invoice_no else ""
        lines.append(f"  {r.medicine_name}{company_str}: +{r.quantity} units on {date_str}{supplier_str}{invoice_str}")
    return f"{len(rows)} restock record(s) in the last {days} day(s):\n" + "\n".join(lines)


@function_tool
async def get_supplier_summary(ctx: RunContextWrapper[PharmacyContext], date_range: str = "this year") -> str:
    """Summarize total stock received per supplier over a time period, and show Accounts Payable balance per supplier if tracked."""
    db = ctx.context.db
    start, end = _parse_date_range(date_range)
    logger.info("tool=get_supplier_summary user=%s range=%s/%s", ctx.context.user_id, start, end)

    rows = (await db.execute(
        select(
            StockReceiving.supplier_name,
            func.count(StockReceiving.id).label("deliveries"),
            func.sum(StockReceiving.quantity).label("total_qty"),
        )
        .where(
            StockReceiving.supplier_name.isnot(None),
            StockReceiving.received_at >= start,
            StockReceiving.received_at <= end,
        )
        .group_by(StockReceiving.supplier_name)
        .order_by(func.sum(StockReceiving.quantity).desc())
    )).all()

    total_without_supplier = (await db.execute(
        select(func.count(StockReceiving.id))
        .where(
            StockReceiving.supplier_name.is_(None),
            StockReceiving.received_at >= start,
            StockReceiving.received_at <= end,
        )
    )).scalar_one()

    if not rows:
        note = f" ({total_without_supplier} receiving record(s) exist but none have supplier names recorded — enter them when receiving stock)" if total_without_supplier else ""
        return f"No supplier data found for {date_range}.{note}"

    # Try to get Accounts Payable balances per supplier
    ap_accounts = (await db.execute(
        select(ChartOfAccount.account_name, ChartOfAccount.id)
        .where(
            ChartOfAccount.account_type == "liability",
            ChartOfAccount.is_active == True,  # noqa: E712
        )
    )).all()

    lines = []
    for r in rows:
        # Fuzzy match supplier to AP account
        ap_balance_str = ""
        for ac in ap_accounts:
            if r.supplier_name.lower() in ac.account_name.lower() or ac.account_name.lower() in r.supplier_name.lower():
                bal_row = (await db.execute(
                    select(
                        func.coalesce(func.sum(JournalEntryLine.credit_amount), 0).label("tc"),
                        func.coalesce(func.sum(JournalEntryLine.debit_amount), 0).label("td"),
                    ).where(JournalEntryLine.account_id == ac.id)
                )).one()
                balance = Decimal(str(bal_row.tc)) - Decimal(str(bal_row.td))
                if balance != 0:
                    ap_balance_str = f", payable Rs. {balance:,.2f}"
                break
        lines.append(
            f"  {r.supplier_name}: {r.deliveries} delivery/deliveries, {int(r.total_qty)} units received{ap_balance_str}"
        )

    result = f"Supplier summary for {date_range}:\n" + "\n".join(lines)
    if total_without_supplier:
        result += f"\n  ({total_without_supplier} receiving record(s) have no supplier name recorded)"
    return result


# ── Agent ─────────────────────────────────────────────────────────────────────

_AGENT: Agent[PharmacyContext] = Agent(
    name="Pharmacy Business Assistant",
    model="gpt-4o-mini",
    instructions=(
        "You are a concise pharmacy business assistant for PharmaCare. "
        "You can answer questions about: sales, expenses, profit, account balances, "
        "inventory stock levels, medicines by company/manufacturer, out-of-stock items, "
        "expiring or expired medicines, recently restocked items, slow-moving or dead stock, "
        "inventory value (cost and selling), supplier purchase summaries, "
        "and detailed information about any specific medicine. "
        "Always state amounts in Pakistani Rupees (Rs.). "
        "Keep answers short and conversational — they will be read aloud. "
        "Do not use markdown, bullet symbols, or formatting characters. "
        "IMPORTANT: Always respond in English only, regardless of what language the user speaks in. "
        "If a field like expiry date or cost price is not recorded for a medicine, say so clearly. "
        "If asked something outside pharmacy business data, politely say you can only help with business queries."
    ),
    tools=[
        get_sales_summary,
        get_expenses_summary,
        get_account_balance,
        get_profit_summary,
        get_low_stock_medicines,
        get_top_selling_medicines,
        get_out_of_stock_medicines,
        get_stock_by_company,
        get_all_companies_summary,
        get_slow_moving_medicines,
        get_medicine_details,
        get_expiring_medicines,
        get_expired_medicines,
        get_stock_value_summary,
        get_recently_restocked,
        get_supplier_summary,
    ],
)


# ── Pipeline helpers ──────────────────────────────────────────────────────────

@dataclass
class PipelineResult:
    transcript: str
    response_text: str
    audio_base64: str

VoicePipelineResult = PipelineResult


async def run_voice_pipeline(
    audio_bytes: bytes,
    user_id: int,
    db: AsyncSession,
) -> VoicePipelineResult:
    client = _get_client()

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
