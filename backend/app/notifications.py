import logging, httpx
from app.core.config import settings
log = logging.getLogger(__name__)
async def send_message(chat_id: int, text: str):
    if not settings.bot_token: return
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(f"https://api.telegram.org/bot{settings.bot_token}/sendMessage", json={"chat_id": chat_id, "text": text})
            r.raise_for_status()
    except Exception: log.exception("Telegram notification failed")
