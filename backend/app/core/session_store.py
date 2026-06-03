import json
from upstash_redis import Redis
from app.core.config import settings

redis = Redis(
    url=settings.upstash_redis_rest_url,
    token=settings.upstash_redis_rest_token,
)


def save_session(session_id: str, data: dict):
    """Store session data with 24h expiry."""
    redis.setex(
        f"session:{session_id}",
        settings.session_ttl,
        json.dumps(data),
    )


def get_session(session_id: str) -> dict | None:
    """Retrieve session data. Returns None if expired or not found."""
    try:
        raw = redis.get(f"session:{session_id}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


def update_session(session_id: str, updates: dict):
    """Merge updates into existing session data."""
    session = get_session(session_id)
    if session:
        session.update(updates)
        save_session(session_id, session)


def delete_session(session_id: str):
    redis.delete(f"session:{session_id}")