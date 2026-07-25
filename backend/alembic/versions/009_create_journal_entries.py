"""create journal_entries and journal_entry_lines tables

Revision ID: 009
Revises: 008
Create Date: 2026-07-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "journal_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "source_type IN ('billing', 'receiving', 'manual')", name="ck_je_source_type"
        ),
    )
    op.create_index("ix_je_entry_date", "journal_entries", ["entry_date"])
    op.create_index("ix_je_source_type", "journal_entries", ["source_type"])
    op.create_index("ix_je_source", "journal_entries", ["source_type", "source_id"])

    op.create_table(
        "journal_entry_lines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "journal_entry_id",
            sa.Integer(),
            sa.ForeignKey("journal_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("chart_of_accounts.id"),
            nullable=False,
        ),
        sa.Column("debit_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("credit_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("note", sa.Text(), nullable=True),
    )
    op.create_index("ix_jel_entry_id", "journal_entry_lines", ["journal_entry_id"])
    op.create_index("ix_jel_account_id", "journal_entry_lines", ["account_id"])


def downgrade() -> None:
    op.drop_table("journal_entry_lines")
    op.drop_table("journal_entries")
