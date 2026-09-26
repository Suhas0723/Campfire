import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql://campfire:campfire@localhost:5432/campfire",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")
    CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
    MEDIA_DIR = os.environ.get("MEDIA_DIR", "./media")
    PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "http://localhost:5173").rstrip("/")
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.6-terra")
    ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_WOMAN = os.environ.get("ELEVENLABS_VOICE_WOMAN", "bD9maNcCuQQS75DGuteM")
    ELEVENLABS_VOICE_MAN = os.environ.get("ELEVENLABS_VOICE_MAN", "HIGUfNOdjuWQwwapnTRW")
    ELEVENLABS_MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    ELEVENLABS_STT_MODEL_ID = os.environ.get("ELEVENLABS_STT_MODEL_ID", "scribe_v2")
    BACKBOARD_API_KEY = os.environ.get("BACKBOARD_API_KEY", "")
    BACKBOARD_BASE_URL = os.environ.get("BACKBOARD_BASE_URL", "").rstrip("/")
    EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "1536"))
    DEFAULT_TRIP_TIMEZONE = os.environ.get("DEFAULT_TRIP_TIMEZONE", "America/Los_Angeles")
    RECAP_HOUR = int(os.environ.get("RECAP_HOUR", "21"))
