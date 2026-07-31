"""add expiry_date, batch_number, cost_price to medicines; supplier_name to stock_receivings

Revision ID: 010
Revises: 009
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("medicines", sa.Column("expiry_date", sa.Date(), nullable=True))
    op.add_column("medicines", sa.Column("batch_number", sa.String(100), nullable=True))
    op.add_column("medicines", sa.Column("cost_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("stock_receivings", sa.Column("supplier_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("medicines", "expiry_date")
    op.drop_column("medicines", "batch_number")
    op.drop_column("medicines", "cost_price")
    op.drop_column("stock_receivings", "supplier_name")
