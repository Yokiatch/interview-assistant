from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import google.generativeai as genai
from app.core.config import settings

genai.configure(api_key=settings.gemini_api_key)

# Connect to Qdrant Cloud instead of in-memory
client = QdrantClient(
    url=settings.qdrant_url,
    api_key=settings.qdrant_api_key,
)

VECTOR_SIZE = 3072


def create_collection(session_id: str):
    """Create a new isolated collection for this session."""
    # Check if it already exists (in case of session resume)
    existing = [c.name for c in client.get_collections().collections]
    if session_id not in existing:
        client.create_collection(
            collection_name=session_id,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


def store_chunks(session_id: str, chunks: list[str], embeddings: list[list[float]]):
    points = [
        PointStruct(
            id=i,
            vector=embeddings[i],
            payload={"text": chunks[i]},
        )
        for i in range(len(chunks))
    ]
    client.upsert(collection_name=session_id, points=points)


def retrieve_chunks(session_id: str, query_vector: list[float], top_k: int) -> list[str]:
    results = client.search(
        collection_name=session_id,
        query_vector=query_vector,
        limit=top_k,
    )
    return [hit.payload["text"] for hit in results]


def embed_query(text: str) -> list[float]:
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type="RETRIEVAL_QUERY",
    )
    return result["embedding"]


def collection_exists(session_id: str) -> bool:
    existing = [c.name for c in client.get_collections().collections]
    return session_id in existing