from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.stock_receiving import StockReceiving
from app.services import journal_entry_service
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
    await db.flush()
    logger.info("Created receiving record invoice=%s medicine=%s qty=%d", invoice_no, medicine_name, quantity)
    return record


async def restock_medicine(
    db: AsyncSession,
    medicine_id: int,
    quantity: int,
    company_invoice_no: Optional[str] = None,
    created_by_id: Optional[int] = None,
    unit_price: Optional[Decimal] = None,
) -> StockReceiving:
    from app.models.medicine import Medicine
    result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise HTTPException(status_code=404, detail=f"Medicine {medicine_id} not found")

    medicine.stock += quantity
    medicine.updated_at = datetime.now(timezone.utc)

    receiving = await create_receiving(
        db,
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        quantity=quantity,
        company_invoice_no=company_invoice_no,
    )

    if created_by_id is not None:
        price = unit_price if unit_price is not None else Decimal(str(medicine.price))
        amount = price * quantity
        await journal_entry_service.post_receiving_entry(
            db,
            receiving_id=receiving.id,
            medicine_name=medicine.name,
            amount=amount,
            created_by_id=created_by_id,
            entry_date=date.today(),
            price_is_estimated=(unit_price is None),
        )

    await db.commit()
    await db.refresh(receiving)
    logger.info("Restocked medicine id=%s +%d new_stock=%d", medicine_id, quantity, medicine.stock)
    return receiving


async def list_receivings(db: AsyncSession) -> list[StockReceiving]:
    result = await db.execute(
        select(StockReceiving).order_by(StockReceiving.received_at.desc())
    )
    return list(result.scalars().all())
