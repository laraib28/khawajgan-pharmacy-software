"""create medicines table

Revision ID: 001
Revises:
Create Date: 2026-04-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "medicines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )
    # Unique index on LOWER(name) for case-insensitive uniqueness
    op.execute(
        "CREATE UNIQUE INDEX idx_medicines_name_lower ON medicines (LOWER(name))"
    )
    op.create_check_constraint("ck_medicines_price", "medicines", "price >= 0")
    op.create_check_constraint("ck_medicines_stock", "medicines", "stock >= 0")


def downgrade() -> None:
    op.drop_table("medicines")
