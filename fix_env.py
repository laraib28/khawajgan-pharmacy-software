import re

with open('backend/.env') as f:
    text = f.read()

key = re.search(r'sk-proj-[A-Za-z0-9_\-]+', text)
db = re.search(r'DATABASE_URL=postgresql[^\n]+neon\.tech/neondb[^\n]*', text)
jwt = re.search(r'JWT_SECRET_KEY=(\S+)', text)

if not key:
    print('ERROR: API key not found in .env')
    exit(1)
if not db:
    print('ERROR: DATABASE_URL not found in .env')
    exit(1)

lines = [
    db.group(),
    'ALLOWED_ORIGINS=https://khawajgan-pharmacy-software.vercel.app,http://localhost:3000',
    'JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60',
    'JWT_REFRESH_TOKEN_EXPIRE_DAYS=7',
    'COOKIE_SECURE=true',
    'FRONTEND_URL=https://khawajgan-pharmacy-software.vercel.app',
    'OPENAI_API_KEY=' + key.group(),
]

if jwt and jwt.group(1):
    lines.insert(1, 'JWT_SECRET_KEY=' + jwt.group(1))

with open('backend/.env', 'w') as f:
    f.write('\n'.join(lines) + '\n')

print('Done. New .env:')
with open('backend/.env') as f:
    for line in f:
        if 'KEY' in line or 'SECRET' in line or 'URL' in line:
            print(' ', line[:60] + '...' if len(line) > 60 else ' ' + line.strip())
