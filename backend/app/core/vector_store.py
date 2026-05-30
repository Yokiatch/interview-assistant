from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid
import google.generativeai as genai
from app.core.config import settings


genai.configure(api_key=settings.gemini_api_key)

# Single in-memory client shared across the app
client = QdrantClient(":memory:")

VECTOR_SIZE = 3072  # dimensions for text-embedding-3-small


def create_collection(session_id: str):
    """Create a new isolated collection for this session."""
    client.create_collection(
        collection_name=session_id,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
    )


def store_chunks(session_id: str, chunks: list[str], embeddings: list[list[float]]):
    """Store text chunks and their embeddings."""
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
    """Retrieve the top-k most relevant chunks for a query vector."""
    results = client.search(
        collection_name=session_id,
        query_vector=query_vector,
        limit=top_k,
    )
    return [hit.payload["text"] for hit in results]

def embed_query(text: str) -> list[float]:
    """
    Embed a search query.
    task_type RETRIEVAL_QUERY is different from RETRIEVAL_DOCUMENT —
    it tells the model this is a question, not a document.
    """
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type="RETRIEVAL_QUERY",
    )
    return result["embedding"]