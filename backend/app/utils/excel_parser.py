from dataclasses import dataclass, field
from io import BytesIO
from typing import Any
import re
import pandas as pd


@dataclass
class ParseError:
    row: int
    reason: str


@dataclass
class ParseResult:
    rows: list[dict[str, Any]] = field(default_factory=list)
    skipped: int = 0
    errors: list[ParseError] = field(default_factory=list)


KEYWORDS = {
    "description", "name", "balance", "stock", "price", "company",
    "composition", "uom", "type", "receipt", "issuance", "medicine", "quant",
}


def _find_col(cols: list[str], keyword: str) -> str | None:
    for c in cols:
        if keyword in c:
            return c
    return None


def _find_header_row(df_raw: pd.DataFrame) -> int:
    best_row, best_count = 0, 0
    for i, row in df_raw.iterrows():
        values = [str(v).lower().strip() for v in row if not pd.isna(v)]
        matches = sum(any(kw in v for kw in KEYWORDS) for v in values)
        if matches > best_count:
            best_count = matches
            best_row = int(i)
    return best_row


def _extract_number(val: Any) -> float | None:
    if pd.isna(val):
        return None
    s = str(val).strip()
    m = re.search(r"\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def _parse_sheet(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Parse a single sheet's dataframe into a list of medicine dicts."""
    cols = list(df.columns)

    name_col = (
        "name" if "name" in cols
        else _find_col(cols, "medicine") or _find_col(cols, "description")
    )
    stock_col = (
        "stock" if "stock" in cols
        else _find_col(cols, "quant") or _find_col(cols, "balance")
    )
    price_col = "price" if "price" in cols else None
    composition_col = _find_col(cols, "composition")
    type_col = _find_col(cols, "type")
    uom_col = _find_col(cols, "uom")

    if not name_col or not stock_col:
        return []

    rows = []
    for _, row in df.iterrows():
        name_val = row[name_col]
        stock_raw = row[stock_col]

        # Skip category/empty rows
        non_null = sum(1 for v in row if not pd.isna(v) and str(v).strip() != "")
        if non_null <= 1:
            continue
        if pd.isna(name_val) or str(name_val).strip() == "":
            continue

        name = str(name_val).strip()
        stock_num = _extract_number(stock_raw)
        if stock_num is None:
            stock_num = 0.0
        if stock_num < 0:
            continue

        rows.append({
            "name": name,
            "price": float(row[price_col]) if price_col and not pd.isna(row[price_col]) else 0.0,
            "stock": int(stock_num),
            "company": str(row["company"]).strip() if "company" in cols and not pd.isna(row["company"]) else "",
            "composition": str(row[composition_col]).strip() if composition_col and not pd.isna(row[composition_col]) else None,
            "type": str(row[type_col]).strip() if type_col and not pd.isna(row[type_col]) else None,
            "uom": str(row[uom_col]).strip() if uom_col and not pd.isna(row[uom_col]) else None,
        })
    return rows


def parse_excel(file_bytes: bytes) -> ParseResult:
    xl = pd.ExcelFile(BytesIO(file_bytes), engine="openpyxl")
    result = ParseResult()
    seen: dict[str, dict] = {}

    all_rows: list[dict] = []
    for sheet in xl.sheet_names:
        try:
            df_raw = pd.read_excel(BytesIO(file_bytes), engine="openpyxl", sheet_name=sheet, header=None, nrows=20)
            header_row = _find_header_row(df_raw)
            df = pd.read_excel(BytesIO(file_bytes), engine="openpyxl", sheet_name=sheet, header=header_row)
            df.columns = df.columns.str.lower().str.strip().str.replace("\xa0", " ", regex=False).str.strip()
            sheet_rows = _parse_sheet(df)
            print(f"[DEBUG] Sheet '{sheet}': {len(sheet_rows)} medicines")
            all_rows.extend(sheet_rows)
        except Exception as e:
            print(f"[DEBUG] Sheet '{sheet}' skipped: {e}")
            continue

    result.rows = all_rows
    print(f"[DEBUG] Total medicines from all sheets: {len(result.rows)}")
    return result
