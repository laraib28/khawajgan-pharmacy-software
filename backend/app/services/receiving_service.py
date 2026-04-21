from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_receiving import StockReceiving
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def _generate_invoice_no(db: AsyncSession) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"RCV-{today}-"
    result = await db.execute(
        select(func.count()).where(StockReceiving.invoice_no.like(f"{prefix}%"))
    )
    count = result.scalar_one()
    return f"{prefix}{str(count + 1).zfill(4)}"


async def create_receiving(
    db: AsyncSession,
    medicine_id: int,
    medicine_name: str,
    quantity: int,
    company_invoice_no: Optional[str] = None,
) -> StockReceiving:
    invoice_no = await _generate_invoice_no(db)
    record = StockReceiving(
        invoice_no=invoice_no,
        company_invoice_no=company_invoice_no or None,
        medicine_id=medicine_id,
        medicine_name=medicine_name,
        quantity=quantity,
    )
    db.add(record)
    await db.flush()  # get id without committing (caller commits)
    logger.info("Created receiving record invoice=%s medicine=%s qty=%d", invoice_no, medicine_name, quantity)
    return record


async def list_receivings(db: AsyncSession) -> list[StockReceiving]:
    result = await db.execute(
        select(StockReceiving).order_by(StockReceiving.received_at.desc())
    )
    return list(result.scalars().all())
