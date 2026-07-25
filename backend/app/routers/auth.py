import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.user import LoginIn, RegisterIn, UserOut
from app.services import auth_service
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_IS_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
_ACCESS_TTL = auth_service.ACCESS_TOKEN_EXPIRE_MINUTES * 60
_REFRESH_TTL = auth_service.REFRESH_TOKEN_EXPIRE_DAYS * 86400


def _set_tokens(response: Response, user: User) -> None:
    access = auth_service.create_access_token(user.id)
    refresh = auth_service.create_refresh_token(user.id)
    response.set_cookie("access_token", access, httponly=True, secure=_IS_SECURE, samesite="lax", max_age=_ACCESS_TTL, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=_IS_SECURE, samesite="lax", max_age=_REFRESH_TTL, path="/")


@router.post("/register", response_model=UserOut, status_code=201)
async def register(data: RegisterIn, response: Response, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        user = await auth_service.register_user(db, data)
    _set_tokens(response, user)
    return user


@router.post("/login", response_model=UserOut)
async def login(data: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        user = await auth_service.authenticate_user(db, data.email, data.password)
        user.updated_at = datetime.now(timezone.utc)
    _set_tokens(response, user)
    return user


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    user_id = auth_service.decode_token(token, "refresh")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    _set_tokens(response, user)
    return {"detail": "Token refreshed"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"detail": "Logged out"}


@router.get("/google/login")
async def google_login():
    return RedirectResponse(auth_service.get_google_auth_url())


@router.get("/google/callback")
async def google_callback(code: str, response: Response, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        user = await auth_service.handle_google_callback(db, code)
    redirect = RedirectResponse(auth_service.FRONTEND_URL, status_code=302)
    _set_tokens(redirect, user)
    return redirect
