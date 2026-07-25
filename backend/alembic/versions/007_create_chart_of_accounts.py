"""create chart_of_accounts table with pharmacy seed data

Revision ID: 007
Revises: 006
Create Date: 2026-07-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chart_of_accounts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_code", sa.String(10), nullable=False),
        sa.Column("account_name", sa.String(255), nullable=False),
        sa.Column("account_type", sa.String(20), nullable=False),
        sa.Column("parent_account_id", sa.Integer(), nullable=True),
        sa.Column("normal_balance", sa.String(10), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_account_id"], ["chart_of_accounts.id"], ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')",
            name="ck_coa_account_type",
        ),
        sa.CheckConstraint(
            "normal_balance IN ('debit', 'credit')",
            name="ck_coa_normal_balance",
        ),
    )
    op.create_unique_constraint("uq_coa_account_code", "chart_of_accounts", ["account_code"])
    op.create_index("ix_coa_account_type", "chart_of_accounts", ["account_type"])
    op.create_index("ix_coa_is_active", "chart_of_accounts", ["is_active"])
    op.create_index("ix_coa_parent_account_id", "chart_of_accounts", ["parent_account_id"])

    # Seed pharmacy Chart of Accounts
    op.execute("""
        INSERT INTO chart_of_accounts
            (account_code, account_name, account_type, parent_account_id, normal_balance, description, is_active)
        VALUES
            -- Assets (debit)
            ('1001', 'Cash in Hand',           'asset',   NULL, 'debit',  'Physical cash kept at the pharmacy counter', true),
            ('1002', 'Bank Account',            'asset',   NULL, 'debit',  'Pharmacy bank account balance', true),
            ('1003', 'Medicine Inventory',      'asset',   NULL, 'debit',  'Value of medicines held in stock', true),
            ('1004', 'Accounts Receivable',     'asset',   NULL, 'debit',  'Amounts owed to the pharmacy by customers or insurers', true),
            ('1005', 'Equipment',               'asset',   NULL, 'debit',  'Pharmacy equipment, fixtures, and furniture', true),

            -- Liabilities (credit)
            ('2001', 'Accounts Payable (Suppliers)', 'liability', NULL, 'credit', 'Amounts owed to medicine suppliers', true),
            ('2002', 'Loans Payable',           'liability', NULL, 'credit', 'Outstanding loan balances', true),

            -- Equity (credit)
            ('3001', 'Owner''s Capital',        'equity',  NULL, 'credit', 'Owner investment in the pharmacy', true),
            ('3002', 'Retained Earnings',       'equity',  NULL, 'credit', 'Accumulated profits retained in the business', true),

            -- Revenue (credit)
            ('4001', 'Medicine Sales Revenue',  'revenue', NULL, 'credit', 'Income from medicine sales', true),
            ('4002', 'Other Income',            'revenue', NULL, 'credit', 'Miscellaneous income not from medicine sales', true),

            -- Expenses (debit)
            ('5001', 'Cost of Medicine Sold',   'expense', NULL, 'debit',  'Direct cost of medicines sold (COGS)', true),
            ('5002', 'Rent Expense',            'expense', NULL, 'debit',  'Monthly rent for pharmacy premises', true),
            ('5003', 'Utilities Expense',       'expense', NULL, 'debit',  'Electricity, water, and other utility bills', true),
            ('5004', 'Salaries Expense',        'expense', NULL, 'debit',  'Monthly salaries for permanent staff', true),
            ('5005', 'Staff Wages',             'expense', NULL, 'debit',  'Daily or hourly wages for part-time staff', true)
    """)


def downgrade() -> None:
    op.drop_index("ix_coa_parent_account_id", "chart_of_accounts")
    op.drop_index("ix_coa_is_active", "chart_of_accounts")
    op.drop_index("ix_coa_account_type", "chart_of_accounts")
    op.drop_constraint("uq_coa_account_code", "chart_of_accounts", type_="unique")
    op.drop_table("chart_of_accounts")
