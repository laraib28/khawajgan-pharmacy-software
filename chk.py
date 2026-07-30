import asyncio, os, sys
sys.path.insert(0, 'backend')
os.chdir('backend')
from dotenv import load_dotenv
load_dotenv()

import asyncpg
from datetime import datetime, timezone, timedelta

PKT = timezone(timedelta(hours=5))
today_pkt = datetime.now(PKT).date()
print("Today (PKT):", today_pkt)

async def run():
    url = os.getenv('DATABASE_URL', '').replace('postgresql+asyncpg', 'postgresql').replace('postgresql://', 'postgresql://')
    c = await asyncpg.connect(url)
    rows = await c.fetch("SELECT id, total_amount, created_at AT TIME ZONE 'Asia/Karachi' as pkt_time FROM sales ORDER BY created_at DESC LIMIT 5")
    print("\nLast 5 sales (Pakistan time):")
    for r in rows:
        print(f"  id={r['id']} amount={r['total_amount']} time={r['pkt_time']}")
    today_rows = await c.fetch(
        "SELECT count(*) as cnt, coalesce(sum(total_amount),0) as total FROM sales WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = $1",
        today_pkt
    )
    print(f"\nToday's sales ({today_pkt}): {today_rows[0]['cnt']} transactions, Rs. {today_rows[0]['total']}")
    await c.close()

asyncio.run(run())
