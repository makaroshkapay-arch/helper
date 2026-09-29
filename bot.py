import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
)

from fastapi import FastAPI
from fastapi.responses import FileResponse

from database import init_db
from api import router as api_router


# =========================================================
# ENV
# =========================================================

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()

WEBAPP_URL = os.getenv(
    "WEBAPP_URL",
    "https://myjotp2p.bothost.tech"
).strip()

PORT = int(os.getenv("PORT", "3000"))

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"


# =========================================================
# LOGGING
# =========================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    title="P2P Myjot",
    version="1.0.0",
)

# API из api.py
app.include_router(api_router)


# =========================================================
# WEB APP
# =========================================================

@app.get("/")
async def index():
    file = WEB_DIR / "index.html"

    if not file.exists():
        return {
            "error": "index.html not found",
            "path": str(file),
        }

    return FileResponse(file)


@app.get("/app.js")
async def javascript():
    file = WEB_DIR / "app.js"

    if not file.exists():
        return {
            "error": "app.js not found",
            "path": str(file),
        }

    return FileResponse(
        file,
        media_type="application/javascript",
    )


@app.get("/style.css")
async def stylesheet():
    file = WEB_DIR / "style.css"

    if not file.exists():
        return {
            "error": "style.css not found",
            "path": str(file),
        }

    return FileResponse(
        file,
        media_type="text/css",
    )


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "P2P Myjot",
        "webapp_url": WEBAPP_URL,
        "port": PORT,
    }


# =========================================================
# TELEGRAM
# =========================================================

router = Router()


@router.message(CommandStart())
async def start(message: Message):

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📊 Открыть P2P Myjot",
                    web_app=WebAppInfo(
                        url=WEBAPP_URL
                    ),
                )
            ]
        ]
    )

    await message.answer(
        "📊 <b>P2P Myjot</b>\n\n"
        "Калькулятор P2P, NFT, гарант сделок, "
        "обмен, комиссии, статистика и история.",
        reply_markup=keyboard,
    )


# =========================================================
# TELEGRAM BOT
# =========================================================

async def main():

    if not BOT_TOKEN:
        raise RuntimeError(
            "BOT_TOKEN не задан"
        )

    logger.info("====================================")
    logger.info("       P2P Myjot")
    logger.info("====================================")

    logger.info(
        "WebApp URL: %s",
        WEBAPP_URL
    )

    logger.info(
        "PORT: %s",
        PORT
    )

    # База
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized")

    # Telegram
    bot = Bot(
        BOT_TOKEN,
        default=DefaultBotProperties(
            parse_mode=ParseMode.HTML
        ),
    )

    dp = Dispatcher()
    dp.include_router(router)

    logger.info("Telegram bot started")

    try:
        await dp.start_polling(bot)

    finally:
        await bot.session.close()
        logger.info("Telegram bot stopped")


# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":
    asyncio.run(main())