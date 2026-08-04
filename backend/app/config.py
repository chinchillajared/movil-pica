import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://mechanic:changeme@db:5432/appointments",
    )
    ALLOWED_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")
        if o.strip()
    ] or ["*"]
    EMAIL_ADDRESS: str = os.getenv("EMAIL_ADDRESS", "")
    EMAILAPP_PASSWORD: str = os.getenv("EMAILAPP_PASSWORD", "")
    SITE_URL: str = os.getenv("SITE_URL", "http://localhost:8081")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "changeme-secret-key")
    # Token lifetimes
    ACCESS_TOKEN_MINUTES: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "60"))
    REFRESH_TOKEN_DAYS: int = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
    # Gmail OAuth
    GMAIL_REDIRECT_PATH: str = "/api/mechanic/gmail/callback"
    # Simple in-memory rate limiting (requests per window per IP)
    RATE_LIMIT_MAX: int = int(os.getenv("RATE_LIMIT_MAX", "20"))
    RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))


settings = Settings()
