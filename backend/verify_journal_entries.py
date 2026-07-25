"""Sanity-check: every journal_entry's lines must have sum(debit) == sum(credit).

Usage (from backend/ with .venv active):
    python verify_journal_entries.py
"""
import asyncio
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv()

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.journal_entry import JournalEntry, JournalEntryLine  # noqa: E402
from sqlalchemy import func, select  # noqa: E402


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(
                JournalEntryLine.journal_entry_id,
                func.sum(JournalEntryLine.debit_amount).label("total_debit"),
                func.sum(JournalEntryLine.credit_amount).label("total_credit"),
            ).group_by(JournalEntryLine.journal_entry_id)
        )
        rows = result.all()

    broken = [r for r in rows if Decimal(str(r.total_debit)) != Decimal(str(r.total_credit))]

    if not broken:
        print(f"✅ All {len(rows)} journal entries are balanced.")
    else:
        print(f"❌ {len(broken)} unbalanced entries found:")
        for r in broken:
            diff = Decimal(str(r.total_debit)) - Decimal(str(r.total_credit))
            print(f"  Entry #{r.journal_entry_id}: Dr={r.total_debit} Cr={r.total_credit} diff={diff:+}")


asyncio.run(main())
