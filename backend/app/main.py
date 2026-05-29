from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.models.schemas import IngestResponse
from app.services.ingest import ingest_document

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}


@app.post("/ingest", response_model=IngestResponse)
async def ingest(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
):
    if resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_bytes = await resume.read()
    session_id, chunks_stored = ingest_document(file_bytes, job_description)

    return IngestResponse(
        session_id=session_id,
        chunks_stored=chunks_stored,
        message=f"Ingested {chunks_stored} chunks successfully.",
    )