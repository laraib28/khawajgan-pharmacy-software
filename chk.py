import asyncio, os, sys
sys.path.insert(0, '/home/ubuntu/pharmacy-software-khawajgan/backend')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/pharmacy-software-khawajgan/backend/.env')

from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text

PKT = timezone(timedelta(hours=5))
today_pkt = datetime.now(PKT).date()
print("Today (PKT):", today_pkt)

DB_URL = os.getenv('DATABASE_URL', '')
print("DB URL prefix:", DB_URL[:40])

async def run():
    engine = create_async_engine(DB_URL)
    async with AsyncSession(engine) as s:
        r = await s.execute(text(
            "SELECT id, total_amount, (created_at AT TIME ZONE 'Asia/Karachi')::date as pkt_date "
            "FROM sales ORDER BY created_at DESC LIMIT 5"
        ))
        print("\nLast 5 sales:")
        for row in r:
            print(f"  id={row.id} amount={row.total_amount} date={row.pkt_date}")

        r2 = await s.execute(text(
            "SELECT count(*) as cnt, coalesce(sum(total_amount),0) as total "
            "FROM sales WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = :d"
        ), {"d": today_pkt})
        row2 = r2.one()
        print(f"\nToday's ({today_pkt}): {row2.cnt} sales, Rs. {row2.total}")
    await engine.dispose()

asyncio.run(run())
