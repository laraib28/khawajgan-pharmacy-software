from datetime import datetime
from decimal import Decimal
from sqlalchemy import CheckConstraint, DateTime, Numeric, String, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Medicine(Base):
    __tablename__ = "medicines"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_medicines_price"),
        CheckConstraint("stock >= 0", name="ck_medicines_stock"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    stock: Mapped[int] = mapped_column(Integer, nullable=False)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    composition: Mapped[str | None] = mapped_column(String(500), nullable=True)
    type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uom: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    sale_items: Mapped[list["SaleItem"]] = relationship(  # noqa: F821
        "SaleItem", back_populates="medicine"
    )
