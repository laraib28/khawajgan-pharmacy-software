from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.medicine import Medicine
from app.utils.excel_parser import ParseError, parse_excel
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["import"])


@router.post("/upload-excel")
async def upload_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=415, detail="Only .xlsx files are accepted")

    content = await file.read()

    try:
        parsed = parse_excel(content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not parsed.rows:
        return {
            "inserted": 0,
            "skipped": parsed.skipped,
            "errors": [{"row": e.row, "reason": e.reason} for e in parsed.errors],
            "message": "No valid records to import",
        }

    inserted = 0
    extra_skipped = 0

    async with db.begin():
        for row in parsed.rows:
            # Skip if medicine name already exists in DB (case-insensitive)
            exists = await db.execute(
                select(Medicine).where(
                    func.lower(Medicine.name) == row["name"].lower()
                )
            )
            if exists.scalar_one_or_none():
                extra_skipped += 1
                continue
            db.add(
                Medicine(
                    name=row["name"],
                    price=row["price"],
                    stock=row["stock"],
                    company=row["company"],
                    composition=row.get("composition"),
                    type=row.get("type"),
                    uom=row.get("uom"),
                )
            )
            inserted += 1

    logger.info("Excel import: inserted=%s skipped=%s errors=%s", inserted, parsed.skipped + extra_skipped, len(parsed.errors))

    return {
        "inserted": inserted,
        "skipped": parsed.skipped + extra_skipped,
        "errors": [{"row": e.row, "reason": e.reason} for e in parsed.errors],
    }
