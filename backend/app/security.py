import hashlib, hmac, json, time
from urllib.parse import parse_qsl
from fastapi import Header, HTTPException, Depends
from app.core.config import settings

def verify_init_data(init_data: str) -> dict:
    if not settings.bot_token: raise HTTPException(503, "Telegram bot is not configured")
    try:
        data = dict(parse_qsl(init_data, keep_blank_values=True)); received = data.pop("hash", ""); auth_date = int(data.get("auth_date", "0"))
    except (ValueError, TypeError): raise HTTPException(401, "Invalid Telegram initData")
    check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret = hmac.new(b"WebAppData", settings.bot_token.encode(), hashlib.sha256).digest()
    actual = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not received or not hmac.compare_digest(actual, received): raise HTTPException(401, "Invalid Telegram signature")
    if not auth_date or abs(time.time() - auth_date) > 86400: raise HTTPException(401, "Telegram initData expired")
    try: user = json.loads(data["user"]); return {"id": int(user["id"]), "first_name": user.get("first_name", "")}
    except (KeyError, ValueError, TypeError, json.JSONDecodeError): raise HTTPException(401, "Telegram user data missing")
async def current_user(x_telegram_init_data: str | None = Header(default=None), x_dev_telegram_user_id: str | None = Header(default=None)):
    if x_telegram_init_data: return verify_init_data(x_telegram_init_data)
    if settings.allow_dev_auth and x_dev_telegram_user_id:
        try: return {"id": int(x_dev_telegram_user_id), "first_name": "Local test"}
        except ValueError: pass
    raise HTTPException(401, "Open this Mini App from Telegram")
async def admin_user(user: dict = Depends(current_user)):
    if user["id"] not in settings.admin_ids: raise HTTPException(403, "Administrator access required")
    return user
