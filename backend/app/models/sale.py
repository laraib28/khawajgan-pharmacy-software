from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, Numeric, String, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[list["SaleItem"]] = relationship(  # noqa: F821
        "SaleItem", back_populates="sale"
    )
