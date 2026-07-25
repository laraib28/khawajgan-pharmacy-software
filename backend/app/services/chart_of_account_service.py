from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chart_of_account import ChartOfAccount
from app.schemas.chart_of_account import (
    AccountType,
    ACCOUNT_TYPE_RANGES,
    NORMAL_BALANCE_MAP,
    ChartOfAccountCreate,
    ChartOfAccountOut,
    ChartOfAccountUpdate,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


def _account_to_out(
    a: ChartOfAccount, children: list[ChartOfAccountOut] | None = None
) -> ChartOfAccountOut:
    return ChartOfAccountOut(
        id=a.id,
        account_code=a.account_code,
        account_name=a.account_name,
        account_type=a.account_type,
        parent_account_id=a.parent_account_id,
        normal_balance=a.normal_balance,
        description=a.description,
        is_active=a.is_active,
        created_at=a.created_at,
        updated_at=a.updated_at,
        children=children if children is not None else [],
    )


def _validate_code_range(account_code: str, account_type: AccountType) -> None:
    try:
        code_int = int(account_code)
    except ValueError:
        raise HTTPException(status_code=400, detail="account_code must be numeric")
    lo, hi = ACCOUNT_TYPE_RANGES[account_type]
    if not (lo <= code_int <= hi):
        raise HTTPException(
            status_code=400,
            detail=f"account_code {account_code} must be between {lo} and {hi} for account_type '{account_type}'",
        )


async def _assert_no_active_children(db: AsyncSession, account_id: int) -> None:
    result = await db.execute(
        select(ChartOfAccount)
        .where(
            ChartOfAccount.parent_account_id == account_id,
            ChartOfAccount.is_active == True,  # noqa: E712
        )
        .limit(1)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate an account that has active child accounts. Deactivate children first.",
        )


def _build_tree(accounts: list[ChartOfAccount]) -> list[ChartOfAccountOut]:
    id_map: dict[int, ChartOfAccountOut] = {a.id: _account_to_out(a) for a in accounts}
    roots: list[ChartOfAccountOut] = []
    for a in accounts:
        node = id_map[a.id]
        if a.parent_account_id is None or a.parent_account_id not in id_map:
            roots.append(node)
        else:
            id_map[a.parent_account_id].children.append(node)
    return roots


async def list_accounts(
    db: AsyncSession,
    account_type: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> list[ChartOfAccountOut]:
    stmt = select(ChartOfAccount).order_by(ChartOfAccount.account_code)
    if account_type:
        stmt = stmt.where(ChartOfAccount.account_type == account_type)
    if is_active is not None:
        stmt = stmt.where(ChartOfAccount.is_active == is_active)
    result = await db.execute(stmt)
    return _build_tree(list(result.scalars().all()))


async def _fetch_children(db: AsyncSession, account_id: int) -> list[ChartOfAccountOut]:
    result = await db.execute(
        select(ChartOfAccount)
        .where(ChartOfAccount.parent_account_id == account_id)
        .order_by(ChartOfAccount.account_code)
    )
    return [_account_to_out(c) for c in result.scalars().all()]


async def get_account(db: AsyncSession, account_id: int) -> ChartOfAccountOut:
    result = await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return _account_to_out(account, await _fetch_children(db, account_id))


async def create_account(db: AsyncSession, data: ChartOfAccountCreate) -> ChartOfAccountOut:
    _validate_code_range(data.account_code, data.account_type)

    existing = await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.account_code == data.account_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Account code '{data.account_code}' already exists",
        )

    if data.parent_account_id is not None:
        parent_result = await db.execute(
            select(ChartOfAccount).where(ChartOfAccount.id == data.parent_account_id)
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent account not found")
        if parent.account_type != data.account_type:
            raise HTTPException(
                status_code=400,
                detail=f"Parent account type '{parent.account_type}' must match child account type '{data.account_type}'",
            )

    account = ChartOfAccount(
        account_code=data.account_code,
        account_name=data.account_name,
        account_type=data.account_type.value,
        parent_account_id=data.parent_account_id,
        normal_balance=NORMAL_BALANCE_MAP[data.account_type],
        description=data.description,
        is_active=True,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    logger.info("Created account code=%s name=%s", account.account_code, account.account_name)
    # New accounts always have no children
    return _account_to_out(account)


async def update_account(
    db: AsyncSession, account_id: int, data: ChartOfAccountUpdate
) -> ChartOfAccountOut:
    result = await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

    if data.is_active is False and account.is_active is True:
        await _assert_no_active_children(db, account_id)

    if data.account_name is not None:
        account.account_name = data.account_name
    if data.description is not None:
        account.description = data.description
    if data.is_active is not None:
        account.is_active = data.is_active
    account.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(account)
    logger.info("Updated account id=%s code=%s", account.id, account.account_code)
    # Children are unchanged by an update — fetch once to include in response
    return _account_to_out(account, await _fetch_children(db, account_id))


async def deactivate_account(db: AsyncSession, account_id: int) -> None:
    result = await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

    await _assert_no_active_children(db, account_id)

    account.is_active = False
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("Deactivated account id=%s code=%s", account.id, account.account_code)
