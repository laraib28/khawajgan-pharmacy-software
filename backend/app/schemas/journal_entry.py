from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class JournalEntryLineCreate(BaseModel):
    account_id: int
    debit_amount: Decimal = Field(default=Decimal("0"), ge=0)
    credit_amount: Decimal = Field(default=Decimal("0"), ge=0)
    note: Optional[str] = Field(None, max_length=500)


class JournalEntryCreate(BaseModel):
    entry_date: date
    description: str = Field(..., min_length=1, max_length=500)
    lines: list[JournalEntryLineCreate] = Field(..., min_length=2)


class JournalEntryLineOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    account_id: int
    account_code: str
    account_name: str
    debit_amount: Decimal
    credit_amount: Decimal
    note: Optional[str]


class JournalEntryOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    entry_date: date
    description: str
    source_type: str
    source_id: Optional[int]
    created_by_id: int
    created_at: datetime
    lines: list[JournalEntryLineOut]
    total_debit: Decimal
    total_credit: Decimal


class AccountBalanceOut(BaseModel):
    account_id: int
    account_code: str
    account_name: str
    normal_balance: str
    balance: Decimal
