import os
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

# Ensure asyncpg driver is used
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg does not support sslmode/channel_binding query params — strip them
parsed = urlparse(DATABASE_URL)
params = parse_qs(parsed.query)
needs_ssl = params.pop("sslmode", ["disable"])[0] in ("require", "verify-ca", "verify-full")
params.pop("channel_binding", None)
clean_query = urlencode({k: v[0] for k, v in params.items()})
DATABASE_URL = urlunparse(parsed._replace(query=clean_query))

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args={"ssl": "require"} if needs_ssl else {},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
