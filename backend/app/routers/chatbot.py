from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services import chatbot_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/chatbot", tags=["chatbot"], dependencies=[Depends(get_current_user)])

_MAX_BYTES = 25 * 1024 * 1024


def _handle_exc(exc: Exception, user_id: int) -> None:
    if isinstance(exc, RuntimeError):
        raise HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, TimeoutError):
        raise HTTPException(status_code=504, detail="Request timed out. Please try again.")
    logger.exception("Chatbot pipeline error user=%s", user_id)
    raise HTTPException(status_code=500, detail="Processing failed. Please try again.")


@router.post("/voice")
async def voice_query(
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await audio.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 25 MB)")
    if len(content) < 500:
        raise HTTPException(status_code=422, detail="Recording too short — please speak for at least a second")

    try:
        result = await chatbot_service.run_voice_pipeline(content, current_user.id, db)
    except Exception as exc:
        _handle_exc(exc, current_user.id)

    return JSONResponse({
        "transcript": result.transcript,
        "response": result.response_text,
        "audio_base64": result.audio_base64,
    })


@router.post("/text")
async def text_query(
    message: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    try:
        result = await chatbot_service.run_text_pipeline(message.strip(), current_user.id, db)
    except Exception as exc:
        _handle_exc(exc, current_user.id)

    return JSONResponse({
        "response": result.response_text,
        "audio_base64": result.audio_base64,
    })
