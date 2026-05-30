from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str
    groq_api_key: str
    app_name: str = "Interview Assistant"
    max_questions: int = 5
    top_k_chunks: int = 4          # how many chunks to retrieve for RAG
    chunk_size: int = 500          # characters per chunk
    chunk_overlap: int = 50        # overlap between chunks (prevents context loss at boundaries)

    class Config:
        env_file = ".env"

settings = Settings()