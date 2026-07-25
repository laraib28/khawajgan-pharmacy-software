"""One-time script to create the initial admin (owner) account.

Usage (from the backend/ directory with .venv active):
    python create_admin.py
"""
import asyncio
import sys
from getpass import getpass

from dotenv import load_dotenv

load_dotenv()

from app.database import AsyncSessionLocal  # noqa: E402 — must be after load_dotenv
from app.models.user import User  # noqa: E402
from app.services.auth_service import hash_password  # noqa: E402
from sqlalchemy import select  # noqa: E402


async def main() -> None:
    email = input("Admin email: ").strip()
    full_name = input("Full name: ").strip()
    password = getpass("Password (min 8 chars): ")
    if len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == email))
        if existing:
            print(f"A user with email {email!r} already exists.")
            sys.exit(1)
        user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
                role="owner",
            auth_provider="email",
        )
        db.add(user)
        await db.commit()

    print(f"✅ Admin user {email!r} created successfully.")


asyncio.run(main())
