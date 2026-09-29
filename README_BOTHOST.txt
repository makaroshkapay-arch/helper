P2P Myjot — Bothost deployment

1. Upload this project to Bothost. Main file: bot.py
2. Web port: 3000
3. Add env vars in Bothost:
BOT_TOKEN=your Telegram bot token
WEBAPP_URL=https://YOUR-DOMAIN.bothost.tech
DATABASE_URL=sqlite+aiosqlite:////app/data/p2p_helper.db
PORT=3000
DATA_DIR=/app/data
4. Enable a Bothost domain and use its HTTPS URL in WEBAPP_URL.
5. Restart/rebuild the bot.
6. Open https://YOUR-DOMAIN.bothost.tech/health — should return JSON status=ok.
7. In Telegram send /start to the bot and open P2P Myjot.

Important: do not put BOT_TOKEN into a public Git repository.
