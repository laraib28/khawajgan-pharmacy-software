from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AccountType(str, Enum):
    asset = "asset"
    liability = "liability"
    equity = "equity"
    revenue = "revenue"
    expense = "expense"


ACCOUNT_TYPE_RANGES = {
    AccountType.asset: (1000, 1999),
    AccountType.liability: (2000, 2999),
    AccountType.equity: (3000, 3999),
    AccountType.revenue: (4000, 4999),
    AccountType.expense: (5000, 5999),
}

NORMAL_BALANCE_MAP = {
    AccountType.asset: "debit",
    AccountType.liability: "credit",
    AccountType.equity: "credit",
    AccountType.revenue: "credit",
    AccountType.expense: "debit",
}


class ChartOfAccountCreate(BaseModel):
    account_code: str = Field(..., min_length=4, max_length=10)
    account_name: str = Field(..., min_length=1, max_length=255)
    account_type: AccountType
    parent_account_id: Optional[int] = None
    description: Optional[str] = None


class ChartOfAccountUpdate(BaseModel):
    account_name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ChartOfAccountOut(BaseModel):
    id: int
    account_code: str
    account_name: str
    account_type: str
    parent_account_id: Optional[int]
    normal_balance: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    children: list["ChartOfAccountOut"] = []

    model_config = {"from_attributes": True}


ChartOfAccountOut.model_rebuild()
