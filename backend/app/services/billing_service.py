from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.medicine import Medicine
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.schemas.sale import InvoiceItem, InvoiceOut, SaleCreate
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def create_sale(db: AsyncSession, data: SaleCreate) -> InvoiceOut:
    async with db.begin():
        invoice_items: list[InvoiceItem] = []
        total = Decimal("0")

        # Phase 1: validate all items with row-lock (SELECT FOR UPDATE)
        for item in data.items:
            result = await db.execute(
                select(Medicine)
                .where(Medicine.id == item.medicine_id)
                .with_for_update()
            )
            medicine = result.scalar_one_or_none()
            if not medicine:
                raise HTTPException(
                    status_code=422,
                    detail=f"Medicine with id {item.medicine_id} not found",
                )
            if medicine.stock < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient stock for {medicine.name}: "
                        f"requested {item.quantity}, available {medicine.stock}"
                    ),
                )

        # Phase 2: deduct stock, build invoice items (re-fetch already locked)
        for item in data.items:
            result = await db.execute(
                select(Medicine)
                .where(Medicine.id == item.medicine_id)
                .with_for_update()
            )
            medicine = result.scalar_one()
            medicine.stock -= item.quantity
            line_total = Decimal(str(medicine.price)) * item.quantity
            total += line_total
            invoice_items.append(
                InvoiceItem(
                    name=medicine.name,
                    quantity=item.quantity,
                    price=medicine.price,
                    amount=line_total,
                )
            )

        # Phase 3: persist sale record
        sale = Sale(patient_name=data.patient_name, total_amount=total)
        db.add(sale)
        await db.flush()  # get sale.id before sale_items insert

        for idx, item in enumerate(data.items):
            db.add(
                SaleItem(
                    sale_id=sale.id,
                    medicine_id=item.medicine_id,
                    quantity=item.quantity,
                    price=invoice_items[idx].price,
                )
            )

    # Transaction committed; refresh to get created_at
    await db.refresh(sale)
    logger.info(
        "Sale id=%s patient=%s total=%s items=%s",
        sale.id,
        data.patient_name,
        total,
        len(data.items),
    )

    return InvoiceOut(
        sale_id=sale.id,
        patient_name=sale.patient_name,
        created_at=sale.created_at,
        items=invoice_items,
        total_amount=total,
    )
