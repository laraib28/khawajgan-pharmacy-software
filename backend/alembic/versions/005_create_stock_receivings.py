"""create stock_receivings table

Revision ID: 005
Revises: 004
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_receivings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_no", sa.String(50), nullable=False),
        sa.Column("company_invoice_no", sa.String(100), nullable=True),
        sa.Column("medicine_id", sa.Integer(), nullable=False),
        sa.Column("medicine_name", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_no"),
        sa.ForeignKeyConstraint(["medicine_id"], ["medicines.id"]),
        sa.CheckConstraint("quantity > 0", name="ck_stock_receivings_quantity"),
    )
    op.create_index("ix_stock_receivings_received_at", "stock_receivings", ["received_at"])


def downgrade() -> None:
    op.drop_index("ix_stock_receivings_received_at", "stock_receivings")
    op.drop_table("stock_receivings")
