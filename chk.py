import os
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/pharmacy-software-khawajgan/backend/.env')

import psycopg2
from datetime import datetime, timezone, timedelta

PKT = timezone(timedelta(hours=5))
today_pkt = datetime.now(PKT).date()
today_utc = datetime.now(timezone.utc).date()
print("Today PKT:", today_pkt, "  Today UTC:", today_utc)

url = os.getenv('DATABASE_URL', '').replace('postgresql+asyncpg', 'postgresql')
conn = psycopg2.connect(url)
cur = conn.cursor()

# Show raw created_at values for last 5 sales
cur.execute("SELECT id, total_amount, created_at FROM sales ORDER BY id DESC LIMIT 5")
print("\nLast 5 sales (raw created_at from DB):")
for row in cur.fetchall():
    print(f"  id={row[0]} amount={row[1]} created_at={row[2]}")

# Check column type
cur.execute("SELECT data_type FROM information_schema.columns WHERE table_name='sales' AND column_name='created_at'")
col = cur.fetchone()
print(f"\ncreated_at column type: {col[0] if col else 'unknown'}")
conn.close()
