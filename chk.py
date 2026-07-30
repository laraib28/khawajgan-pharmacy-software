import os
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/pharmacy-software-khawajgan/backend/.env')

import psycopg2
from datetime import datetime, timezone, timedelta

PKT = timezone(timedelta(hours=5))
today_pkt = datetime.now(PKT).date()
print("Today (PKT):", today_pkt)

url = os.getenv('DATABASE_URL', '').replace('postgresql+asyncpg', 'postgresql')
print("Connecting...")
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("SELECT id, total_amount, (created_at AT TIME ZONE 'Asia/Karachi')::date FROM sales ORDER BY created_at DESC LIMIT 5")
print("\nLast 5 sales (PKT date):")
for row in cur.fetchall():
    print(f"  id={row[0]} amount={row[1]} date={row[2]}")

cur.execute("SELECT count(*), coalesce(sum(total_amount),0) FROM sales WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = %s", (today_pkt,))
cnt, total = cur.fetchone()
print(f"\nToday ({today_pkt}): {cnt} sales, Rs. {total}")
conn.close()
