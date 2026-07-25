from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        CheckConstraint(
            "source_type IN ('billing', 'receiving', 'manual')",
            name="ck_je_source_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lines: Mapped[list["JournalEntryLine"]] = relationship(
        "JournalEntryLine", back_populates="entry", cascade="all, delete-orphan"
    )


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    journal_entry_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("chart_of_accounts.id"), nullable=False
    )
    debit_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0")
    )
    credit_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0")
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="lines")
    account: Mapped["ChartOfAccount"] = relationship("ChartOfAccount")  # noqa: F821
