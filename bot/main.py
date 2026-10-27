
import asyncio
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    WebAppInfo,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    bot_token: str = ""
    mini_app_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


async def main():
    if not settings.bot_token:
        raise RuntimeError(
            "BOT_TOKEN is missing. Check the root .env file."
        )

    if not settings.mini_app_url.startswith("https://"):
        raise RuntimeError(
            "MINI_APP_URL must be an HTTPS URL for Telegram Web App."
        )

    bot = Bot(settings.bot_token)
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def start(message: Message):
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="Записаться онлайн",
                        web_app=WebAppInfo(url=settings.mini_app_url),
                    )
                ]
            ]
        )

        await message.answer(
            "🖤 Добро пожаловать в INK HOUSE!\n\n"
            "Выбери мастера, услугу и удобное время "
            "для своей будущей татуировки.",
            reply_markup=keyboard,
        )

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
