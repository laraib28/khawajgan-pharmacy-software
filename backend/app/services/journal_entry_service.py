from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chart_of_account import ChartOfAccount
from app.models.journal_entry import JournalEntry, JournalEntryLine
from app.schemas.journal_entry import (
    AccountBalanceOut,
    JournalEntryCreate,
    JournalEntryLineOut,
    JournalEntryOut,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

_CODE_CASH = "1001"      # Cash in Hand
_CODE_REVENUE = "4001"   # Medicine Sales Revenue
_CODE_INVENTORY = "1003" # Medicine Inventory
_CODE_PAYABLE = "2001"   # Accounts Payable (Suppliers)


async def _resolve_account(db: AsyncSession, code: str) -> Optional[ChartOfAccount]:
    return await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.account_code == code,
            ChartOfAccount.is_active == True,  # noqa: E712
        )
    )


def _validate_lines(lines: list) -> None:
    if len(lines) < 2:
        raise HTTPException(status_code=400, detail="A journal entry must have at least 2 lines")
    for line in lines:
        has_debit = line.debit_amount > 0
        has_credit = line.credit_amount > 0
        if has_debit == has_credit:
            raise HTTPException(
                status_code=400,
                detail="Each line must have exactly one non-zero amount: either debit_amount or credit_amount",
            )
    total_debit = sum(l.debit_amount for l in lines)
    total_credit = sum(l.credit_amount for l in lines)
    if total_debit != total_credit:
        diff = abs(total_debit - total_credit)
        raise HTTPException(
            status_code=400,
            detail=f"Debits ({total_debit}) must equal credits ({total_credit}). Difference: {diff}",
        )


def _line_to_out(line: JournalEntryLine) -> JournalEntryLineOut:
    return JournalEntryLineOut(
        id=line.id,
        account_id=line.account_id,
        account_code=line.account.account_code,
        account_name=line.account.account_name,
        debit_amount=line.debit_amount,
        credit_amount=line.credit_amount,
        note=line.note,
    )


def _entry_to_out(entry: JournalEntry) -> JournalEntryOut:
    lines_out = [_line_to_out(l) for l in entry.lines]
    total_debit = sum(l.debit_amount for l in lines_out)
    total_credit = sum(l.credit_amount for l in lines_out)
    return JournalEntryOut(
        id=entry.id,
        entry_date=entry.entry_date,
        description=entry.description,
        source_type=entry.source_type,
        source_id=entry.source_id,
        created_by_id=entry.created_by_id,
        created_at=entry.created_at,
        lines=lines_out,
        total_debit=total_debit,
        total_credit=total_credit,
    )


async def _load_entry(db: AsyncSession, entry_id: int) -> JournalEntry:
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines).selectinload(JournalEntryLine.account))
        .where(JournalEntry.id == entry_id)
    )
    if not entry:
        raise HTTPException(status_code=404, detail=f"Journal entry {entry_id} not found")
    return entry


async def _post_raw(
    db: AsyncSession,
    description: str,
    source_type: str,
    source_id: Optional[int],
    created_by_id: int,
    entry_date: date,
    raw_lines: list[tuple[int, Decimal, Decimal]],
    line_note: Optional[str] = None,
) -> JournalEntry:
    """Create a journal entry + lines without committing. Caller owns the transaction."""
    entry = JournalEntry(
        entry_date=entry_date,
        description=description,
        source_type=source_type,
        source_id=source_id,
        created_by_id=created_by_id,
    )
    db.add(entry)
    await db.flush()
    for account_id, debit, credit in raw_lines:
        db.add(JournalEntryLine(
            journal_entry_id=entry.id,
            account_id=account_id,
            debit_amount=debit,
            credit_amount=credit,
            note=line_note,
        ))
    await db.flush()
    logger.info("Posted journal entry id=%s type=%s source_id=%s", entry.id, source_type, source_id)
    return entry


# ── Auto-entry helpers (called inside billing/receiving transactions) ─────────

async def post_sale_entry(
    db: AsyncSession,
    sale_id: int,
    total: Decimal,
    created_by_id: int,
    entry_date: date,
    patient_name: str,
) -> Optional[JournalEntry]:
    cash = await _resolve_account(db, _CODE_CASH)
    revenue = await _resolve_account(db, _CODE_REVENUE)
    if not cash or not revenue:
        logger.warning(
            "Skipping sale journal entry: account %s not found — add accounts %s and %s to Chart of Accounts",
            _CODE_CASH if not cash else _CODE_REVENUE,
            _CODE_CASH,
            _CODE_REVENUE,
        )
        return None
    return await _post_raw(
        db,
        description=f"Medicine sale — {patient_name}",
        source_type="billing",
        source_id=sale_id,
        created_by_id=created_by_id,
        entry_date=entry_date,
        raw_lines=[
            (cash.id, total, Decimal("0")),    # Dr Cash in Hand
            (revenue.id, Decimal("0"), total),  # Cr Medicine Sales Revenue
        ],
    )


async def post_receiving_entry(
    db: AsyncSession,
    receiving_id: int,
    medicine_name: str,
    amount: Decimal,
    created_by_id: int,
    entry_date: date,
    price_is_estimated: bool = False,
) -> Optional[JournalEntry]:
    if amount <= 0:
        logger.warning("Skipping journal entry for receiving_id=%s: amount is zero", receiving_id)
        return None
    inventory = await _resolve_account(db, _CODE_INVENTORY)
    payable = await _resolve_account(db, _CODE_PAYABLE)
    if not inventory or not payable:
        logger.warning(
            "Skipping receiving journal entry: account not found — add accounts %s and %s to Chart of Accounts",
            _CODE_INVENTORY,
            _CODE_PAYABLE,
        )
        return None
    note = "Amount uses selling price as proxy — verify against supplier invoice" if price_is_estimated else None
    return await _post_raw(
        db,
        description=f"Stock received — {medicine_name}",
        source_type="receiving",
        source_id=receiving_id,
        created_by_id=created_by_id,
        entry_date=entry_date,
        raw_lines=[
            (inventory.id, amount, Decimal("0")),   # Dr Medicine Inventory
            (payable.id, Decimal("0"), amount),      # Cr Accounts Payable
        ],
        line_note=note,
    )


# ── Public API ────────────────────────────────────────────────────────────────

async def list_entries(
    db: AsyncSession,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    source_type: Optional[str] = None,
    account_id: Optional[int] = None,
) -> list[JournalEntryOut]:
    stmt = (
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines).selectinload(JournalEntryLine.account))
        .order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())
    )
    if date_from:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)
    if source_type:
        stmt = stmt.where(JournalEntry.source_type == source_type)
    if account_id:
        stmt = stmt.where(
            JournalEntry.id.in_(
                select(JournalEntryLine.journal_entry_id).where(
                    JournalEntryLine.account_id == account_id
                )
            )
        )
    result = await db.execute(stmt)
    return [_entry_to_out(e) for e in result.unique().scalars().all()]


async def get_entry(db: AsyncSession, entry_id: int) -> JournalEntryOut:
    return _entry_to_out(await _load_entry(db, entry_id))


async def create_manual_entry(
    db: AsyncSession, data: JournalEntryCreate, created_by_id: int
) -> JournalEntryOut:
    _validate_lines(data.lines)
    for line in data.lines:
        active = await db.scalar(
            select(ChartOfAccount).where(
                ChartOfAccount.id == line.account_id,
                ChartOfAccount.is_active == True,  # noqa: E712
            )
        )
        if not active:
            raise HTTPException(
                status_code=400,
                detail=f"Account {line.account_id} not found or inactive",
            )
    entry = JournalEntry(
        entry_date=data.entry_date,
        description=data.description,
        source_type="manual",
        source_id=None,
        created_by_id=created_by_id,
    )
    db.add(entry)
    await db.flush()
    for line in data.lines:
        db.add(JournalEntryLine(
            journal_entry_id=entry.id,
            account_id=line.account_id,
            debit_amount=line.debit_amount,
            credit_amount=line.credit_amount,
            note=line.note,
        ))
    await db.commit()
    return _entry_to_out(await _load_entry(db, entry.id))


async def delete_entry(db: AsyncSession, entry_id: int) -> None:
    entry = await db.get(JournalEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Journal entry {entry_id} not found")
    if entry.source_type != "manual":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete a '{entry.source_type}' entry. Use POST /{entry_id}/reverse to correct it.",
        )
    await db.delete(entry)
    await db.commit()


async def reverse_entry(
    db: AsyncSession, entry_id: int, created_by_id: int
) -> JournalEntryOut:
    original = await _load_entry(db, entry_id)
    reversal = JournalEntry(
        entry_date=datetime.now(timezone.utc).date(),
        description=f"Reversal of entry #{original.id}: {original.description}",
        source_type="manual",
        source_id=original.id,
        created_by_id=created_by_id,
    )
    db.add(reversal)
    await db.flush()
    for line in original.lines:
        db.add(JournalEntryLine(
            journal_entry_id=reversal.id,
            account_id=line.account_id,
            debit_amount=line.credit_amount,  # swap
            credit_amount=line.debit_amount,  # swap
            note=f"Reversal of line from entry #{original.id}",
        ))
    await db.commit()
    return _entry_to_out(await _load_entry(db, reversal.id))


async def get_account_balance(db: AsyncSession, account_id: int) -> AccountBalanceOut:
    account = await db.get(ChartOfAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    result = await db.execute(
        select(
            func.coalesce(func.sum(JournalEntryLine.debit_amount), 0).label("td"),
            func.coalesce(func.sum(JournalEntryLine.credit_amount), 0).label("tc"),
        ).where(JournalEntryLine.account_id == account_id)
    )
    row = result.one()
    td, tc = Decimal(str(row.td)), Decimal(str(row.tc))
    balance = (td - tc) if account.normal_balance == "debit" else (tc - td)
    return AccountBalanceOut(
        account_id=account.id,
        account_code=account.account_code,
        account_name=account.account_name,
        normal_balance=account.normal_balance,
        balance=balance,
    )
