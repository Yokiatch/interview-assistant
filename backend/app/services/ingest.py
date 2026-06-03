import uuid
import pypdf
import io
import google.generativeai as genai
from app.core.config import settings
from app.core.vector_store import create_collection, store_chunks
from app.core.session_store import save_session

genai.configure(api_key=settings.gemini_api_key)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text.strip()


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    embeddings = []
    for chunk in chunks:
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=chunk,
            task_type="RETRIEVAL_DOCUMENT",
        )
        embeddings.append(result["embedding"])
    return embeddings


def ingest_document(file_bytes: bytes, job_description: str) -> tuple[str, int]:
    session_id = str(uuid.uuid4())

    resume_text = extract_text_from_pdf(file_bytes)
    combined_text = f"RESUME:\n{resume_text}\n\nJOB DESCRIPTION:\n{job_description}"

    chunks = chunk_text(combined_text, settings.chunk_size, settings.chunk_overlap)
    embeddings = embed_chunks(chunks)

    create_collection(session_id)
    store_chunks(session_id, chunks, embeddings)

    # Persist session metadata to Redis
    save_session(session_id, {
        "job_description": job_description,
        "questions": [],
        "answered_ids": [],
        "chunks_stored": len(chunks),
    })

    return session_id, len(chunks)