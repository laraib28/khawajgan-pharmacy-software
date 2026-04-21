"""add composition, type, uom to medicines

Revision ID: 004
Revises: 003
Create Date: 2026-04-15

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Columns may already exist if table was created outside Alembic
    op.execute("ALTER TABLE medicines ADD COLUMN IF NOT EXISTS composition VARCHAR(500)")
    op.execute("ALTER TABLE medicines ADD COLUMN IF NOT EXISTS type VARCHAR(100)")
    op.execute("ALTER TABLE medicines ADD COLUMN IF NOT EXISTS uom VARCHAR(50)")


def downgrade() -> None:
    op.drop_column("medicines", "uom")
    op.drop_column("medicines", "type")
    op.drop_column("medicines", "composition")
