"""add updated_at to medicines and create inventory_logs table

Revision ID: 006
Revises: 005
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "medicines",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "inventory_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("medicine_id", sa.Integer(), nullable=False),
        sa.Column("medicine_name", sa.String(255), nullable=False),
        sa.Column("field_changed", sa.String(50), nullable=False),
        sa.Column("old_value", sa.String(100), nullable=False),
        sa.Column("new_value", sa.String(100), nullable=False),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["medicine_id"], ["medicines.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_inventory_logs_medicine_id", "inventory_logs", ["medicine_id"])
    op.create_index("ix_inventory_logs_changed_at", "inventory_logs", ["changed_at"])


def downgrade() -> None:
    op.drop_index("ix_inventory_logs_changed_at", "inventory_logs")
    op.drop_index("ix_inventory_logs_medicine_id", "inventory_logs")
    op.drop_table("inventory_logs")
    op.drop_column("medicines", "updated_at")
