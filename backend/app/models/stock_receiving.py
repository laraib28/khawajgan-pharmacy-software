from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class StockReceiving(Base):
    __tablename__ = "stock_receivings"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_receivings_quantity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    company_invoice_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"), nullable=False)
    medicine_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    medicine: Mapped["Medicine"] = relationship("Medicine")  # noqa: F821
