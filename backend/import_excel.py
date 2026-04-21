"""
Import medicine.xlsx into Neon PostgreSQL.

Tables written:
  medicines        — existing app table (upsert by name)
  stock_register   — created if absent
  transactions     — created if absent

Usage:
  cd backend
  python import_excel.py [path/to/medicine.xlsx]
"""

import asyncio
import os
import sys
from pathlib import Path

import asyncpg
import pandas as pd
from dotenv import load_dotenv

# ── locate .env ─────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    sys.exit("DATABASE_URL not set in .env")

# asyncpg uses postgresql://, not postgresql+asyncpg://
ASYNCPG_DSN = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

# ── Excel path ───────────────────────────────────────────────────────────────
EXCEL_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "medicine.xlsx"
if not EXCEL_PATH.exists():
    sys.exit(f"Excel file not found: {EXCEL_PATH}")


# ── DDL ───────────────────────────────────────────────────────────────────────
DDL_MEDICINES = """
CREATE TABLE IF NOT EXISTS medicines (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    price       NUMERIC(10,2) NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT 0,
    company     VARCHAR(255),
    composition VARCHAR(500),
    type        VARCHAR(100),
    uom         VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ck_medicines_price CHECK (price >= 0),
    CONSTRAINT ck_medicines_stock CHECK (stock >= 0)
);
"""

DDL_STOCK_REGISTER = """
CREATE TABLE IF NOT EXISTS stock_register (
    id          SERIAL PRIMARY KEY,
    serial_no   INTEGER,
    name        VARCHAR(255) NOT NULL,
    composition VARCHAR(500),
    type        VARCHAR(100),
    uom         VARCHAR(50),
    opening     INTEGER DEFAULT 0,
    receipt     INTEGER DEFAULT 0,
    issuance    INTEGER DEFAULT 0,
    balance     INTEGER DEFAULT 0
);
"""

DDL_TRANSACTIONS = """
CREATE TABLE IF NOT EXISTS transactions (
    id          SERIAL PRIMARY KEY,
    date        DATE,
    item        VARCHAR(255),
    receipt     INTEGER,
    issuance    INTEGER,
    remarks     TEXT
);
"""


# ── helpers ───────────────────────────────────────────────────────────────────
def _int(val, default=0) -> int:
    try:
        v = int(float(str(val)))
        return v if v >= 0 else default
    except (ValueError, TypeError):
        return default


def _str(val) -> str | None:
    if val is None or (isinstance(val, float) and val != val):
        return None
    s = str(val).strip()
    return s if s else None


# ── data loaders ──────────────────────────────────────────────────────────────
def load_store(path: Path) -> pd.DataFrame:
    """Store sheet → medicines rows (serial, description, composition, type, qty)."""
    df = pd.read_excel(path, sheet_name="Store", header=0)
    df.columns = ["serial", "description", "composition", "type", "category", "qty"]
    # keep only numeric serial rows (skip header/blank rows)
    df = df[df["serial"].apply(lambda x: str(x).replace(".0", "").isdigit() if pd.notna(x) else False)].copy()
    df["serial"] = df["serial"].apply(lambda x: _int(x))
    df["qty"] = df["qty"].apply(lambda x: _int(x))
    return df.reset_index(drop=True)


def load_stock_register(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="Stock register")
    # keep standard columns only
    df = df[["S #", "DESCRIPTION2", "COMPOSITION", "TYPE", "UOM", "OPENING", "RECEIPT", "ISSUANCE", "BALANCE"]].copy()
    df.columns = ["serial_no", "name", "composition", "type", "uom", "opening", "receipt", "issuance", "balance"]
    df = df[df["serial_no"].apply(lambda x: str(x).replace(".0", "").isdigit() if pd.notna(x) else False)].copy()
    for col in ("opening", "receipt", "issuance", "balance"):
        df[col] = df[col].apply(lambda x: _int(x))
    return df.reset_index(drop=True)


def load_transactions(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="TRANSACTION", header=0)
    df.columns = ["_col0", "date", "item", "receipt", "issuance", "remarks"]
    df = df[df["date"].notna() & (df["date"] != "DATE")].copy()
    # convert dates
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
    df = df[df["date"].notna()].copy()
    # receipt / issuance: may be numeric strings or NaN
    df["receipt"] = df["receipt"].apply(lambda x: _int(x) if pd.notna(x) and str(x).strip() not in ("", "nan") else None)
    df["issuance"] = df["issuance"].apply(lambda x: _int(x) if pd.notna(x) and str(x).strip() not in ("", "nan") else None)
    return df[["date", "item", "receipt", "issuance", "remarks"]].reset_index(drop=True)


# ── import routines ───────────────────────────────────────────────────────────
async def import_medicines(conn: asyncpg.Connection, store_df: pd.DataFrame, stock_df: pd.DataFrame):
    """Upsert medicines using stock_register as primary source (has UOM + balance),
    filling gaps with Store sheet data."""
    # build name → row lookup from stock register
    stock_map: dict[str, dict] = {}
    for _, row in stock_df.iterrows():
        name = _str(row["name"])
        if name:
            stock_map[name.upper()] = row.to_dict()

    rows: list[tuple] = []
    seen: set[str] = set()

    # stock register is authoritative
    for _, row in stock_df.iterrows():
        name = _str(row["name"])
        if not name or name.upper() in seen:
            continue
        seen.add(name.upper())
        rows.append((
            name,
            0.00,                     # price unknown — default 0
            _int(row["balance"]),     # current stock = BALANCE
            None,                     # company
            _str(row["composition"]),
            _str(row["type"]),
            _str(row["uom"]),
        ))

    # add any Store-only entries not in stock register
    for _, row in store_df.iterrows():
        name = _str(row["description"])
        if not name or name.upper() in seen:
            continue
        seen.add(name.upper())
        rows.append((
            name,
            0.00,
            _int(row["qty"]),
            None,
            _str(row["composition"]),
            _str(row["type"]),
            None,
        ))

    result = await conn.executemany(
        """
        INSERT INTO medicines (name, price, stock, company, composition, type, uom)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (name) DO UPDATE SET
            stock       = EXCLUDED.stock,
            composition = COALESCE(EXCLUDED.composition, medicines.composition),
            type        = COALESCE(EXCLUDED.type,        medicines.type),
            uom         = COALESCE(EXCLUDED.uom,         medicines.uom)
        """,
        rows,
    )
    print(f"  medicines     : {len(rows)} rows upserted")


async def import_stock_register(conn: asyncpg.Connection, df: pd.DataFrame):
    await conn.execute("TRUNCATE TABLE stock_register RESTART IDENTITY")
    rows = [
        (
            _int(r["serial_no"]),
            _str(r["name"]) or "",
            _str(r["composition"]),
            _str(r["type"]),
            _str(r["uom"]),
            _int(r["opening"]),
            _int(r["receipt"]),
            _int(r["issuance"]),
            _int(r["balance"]),
        )
        for _, r in df.iterrows()
    ]
    await conn.executemany(
        """
        INSERT INTO stock_register (serial_no, name, composition, type, uom, opening, receipt, issuance, balance)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        rows,
    )
    print(f"  stock_register: {len(rows)} rows inserted")


async def import_transactions(conn: asyncpg.Connection, df: pd.DataFrame):
    await conn.execute("TRUNCATE TABLE transactions RESTART IDENTITY")
    def _nullable_int(val):
        if val is None:
            return None
        try:
            f = float(val)
            return None if f != f else int(f)  # NaN check: NaN != NaN
        except (ValueError, TypeError):
            return None

    rows = [
        (
            r["date"],
            _str(r["item"]),
            _nullable_int(r["receipt"]),
            _nullable_int(r["issuance"]),
            _str(r["remarks"]),
        )
        for _, r in df.iterrows()
    ]
    await conn.executemany(
        """
        INSERT INTO transactions (date, item, receipt, issuance, remarks)
        VALUES ($1, $2, $3, $4, $5)
        """,
        rows,
    )
    print(f"  transactions  : {len(rows)} rows inserted")


# ── main ──────────────────────────────────────────────────────────────────────
async def main():
    print(f"Reading {EXCEL_PATH} ...")
    store_df = load_store(EXCEL_PATH)
    stock_df = load_stock_register(EXCEL_PATH)
    tx_df    = load_transactions(EXCEL_PATH)
    print(f"  Store sheet     : {len(store_df)} medicines")
    print(f"  Stock register  : {len(stock_df)} entries")
    print(f"  Transactions    : {len(tx_df)} rows")

    print("\nConnecting to database ...")
    conn = await asyncpg.connect(ASYNCPG_DSN)
    try:
        print("Creating tables if not exist ...")
        await conn.execute(DDL_MEDICINES)
        await conn.execute(DDL_STOCK_REGISTER)
        await conn.execute(DDL_TRANSACTIONS)

        print("\nImporting data ...")
        async with conn.transaction():
            await import_medicines(conn, store_df, stock_df)
            await import_stock_register(conn, stock_df)
            await import_transactions(conn, tx_df)

        print("\nDone. All data committed.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
