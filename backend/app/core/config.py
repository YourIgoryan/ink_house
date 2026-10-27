from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
ROOT = Path(__file__).resolve().parents[3]
class Settings(BaseSettings):
    app_name: str = "INK HOUSE API"
    database_url: str = "sqlite+aiosqlite:///./ink_house.db"
    bot_token: str = ""
    mini_app_url: str = "http://localhost:5173"
    admin_telegram_ids: str = "100001"
    cors_origins: str = "http://localhost:5173"
    allow_dev_auth: bool = True
    studio_timezone: str = "Europe/Moscow"
    studio_open_hour: int = 10
    studio_close_hour: int = 20
    slot_step_minutes: int = 30
    max_upload_mb: int = 8
    model_config = SettingsConfigDict(env_file=ROOT / ".env", env_file_encoding="utf-8", extra="ignore")
    @property
    def admin_ids(self):
        return {int(x.strip()) for x in self.admin_telegram_ids.split(",") if x.strip()}
    @property
    def allowed_origins(self):
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]
settings = Settings()



