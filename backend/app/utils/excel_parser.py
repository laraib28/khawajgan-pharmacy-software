from dataclasses import dataclass, field
from io import BytesIO
from typing import Any
import pandas as pd

# Supported column layouts:
#   Standard:  name, price, stock, company
#   Inventory: description2, balance  (price defaults to 0, company to "")
STANDARD_COLUMNS = {"name", "price", "stock"}
INVENTORY_COLUMNS = {"description2", "balance"}


@dataclass
class ParseError:
    row: int
    reason: str


@dataclass
class ParseResult:
    rows: list[dict[str, Any]] = field(default_factory=list)
    skipped: int = 0
    errors: list[ParseError] = field(default_factory=list)


def _find_col(cols: list[str], keyword: str) -> str | None:
    """Return first column name that contains keyword (case-insensitive)."""
    for c in cols:
        if keyword in c:
            return c
    return None


def _find_header_row(file_bytes: bytes) -> int:
    """Scan first 20 rows to find the row that contains the actual column headers."""
    df_raw = pd.read_excel(BytesIO(file_bytes), engine="openpyxl", header=None, nrows=20)
    keywords = {"description", "name", "balance", "stock"}
    for i, row in df_raw.iterrows():
        values = {str(v).lower().strip() for v in row if not pd.isna(v)}
        if any(any(kw in v for kw in keywords) for v in values):
            return int(i)
    return 0  # fallback to first row


def parse_excel(file_bytes: bytes) -> ParseResult:
    header_row = _find_header_row(file_bytes)
    df = pd.read_excel(BytesIO(file_bytes), engine="openpyxl", header=header_row)

    # Normalise column names to lower-case and strip whitespace (including \xa0)
    df.columns = df.columns.str.lower().str.strip().str.replace("\xa0", " ", regex=False).str.strip()
    cols = list(df.columns)

    # Auto-detect name column: prefer exact "name", else any col with "description"
    name_col = "name" if "name" in cols else _find_col(cols, "description")
    # Auto-detect stock column: prefer exact "stock", else "balance"
    stock_col = "stock" if "stock" in cols else _find_col(cols, "balance")
    # Auto-detect price column: prefer "price", else None (default 0)
    price_col = "price" if "price" in cols else None

    if not name_col:
        raise ValueError(
            f"Could not find a name/description column. Found columns: {cols}"
        )
    if not stock_col:
        raise ValueError(
            f"Could not find a stock/balance column. Found columns: {cols}"
        )

    df = df.rename(columns={name_col: "name", stock_col: "stock"})
    if price_col:
        df = df.rename(columns={price_col: "price"})
    else:
        df["price"] = 0.0

    df["company"] = df["company"].fillna("").astype(str) if "company" in df.columns else ""

    # Map optional columns: composition, type, uom
    composition_col = _find_col(cols, "composition")
    type_col = _find_col(cols, "type")
    uom_col = _find_col(cols, "uom")

    result = ParseResult()
    drop_idx = []

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # 1-based, accounting for header row
        name_val = row["name"]
        stock_val = row["stock"]

        if pd.isna(name_val) or str(name_val).strip() == "":
            result.errors.append(ParseError(row=row_num, reason="name is null or empty"))
            drop_idx.append(idx)
        elif pd.isna(stock_val):
            result.errors.append(ParseError(row=row_num, reason="stock/balance is null"))
            drop_idx.append(idx)
        elif int(float(stock_val)) < 0:
            result.errors.append(ParseError(row=row_num, reason="stock must be >= 0"))
            drop_idx.append(idx)

    df = df.drop(index=drop_idx)

    # Remove duplicates within the file (first occurrence wins)
    before = len(df)
    df = df.drop_duplicates(subset=["name"], keep="first")
    result.skipped += before - len(df)

    for _, row in df.iterrows():
        result.rows.append(
            {
                "name": str(row["name"]).strip(),
                "price": float(row["price"]),
                "stock": int(float(row["stock"])),
                "company": str(row["company"]),
                "composition": str(row[composition_col]).strip() if composition_col and not pd.isna(row[composition_col]) else None,
                "type": str(row[type_col]).strip() if type_col and not pd.isna(row[type_col]) else None,
                "uom": str(row[uom_col]).strip() if uom_col and not pd.isna(row[uom_col]) else None,
            }
        )

    return result
