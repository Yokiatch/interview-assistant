from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    gemini_api_key: str
    groq_api_key: str
    qdrant_url: str
    qdrant_api_key: str
    upstash_redis_rest_url: str
    upstash_redis_rest_token: str
    app_name: str = "Interview Assistant"
    max_questions: int = 5
    top_k_chunks: int = 4
    chunk_size: int = 500
    chunk_overlap: int = 50
    session_ttl: int = 86400  # 24 hours in seconds

    class Config:
        env_file = ".env"

settings = Settings()