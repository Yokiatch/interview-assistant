import json
from groq import Groq
from app.core.config import settings
from app.core.vector_store import retrieve_chunks, embed_query
from app.models.schemas import Question

groq_client = Groq(api_key=settings.groq_api_key)


def generate_questions(session_id: str, job_description: str) -> list[Question]:
    # Step 1: retrieve relevant chunks
    query_vector = embed_query(job_description)
    chunks = retrieve_chunks(session_id, query_vector, top_k=settings.top_k_chunks)
    context = "\n\n---\n\n".join(chunks)

    # Step 2: build prompt
    prompt = f"""You are a senior technical interviewer. Based on the resume and job description below, generate exactly {settings.max_questions} interview questions.

CONTEXT:
{context}

RULES:
- Questions must be specific to this candidate and this role — no generic questions
- Mix of categories: technical, behavioral, resume-specific
- Each question should be answerable in 2-3 minutes verbally
- Return ONLY a JSON array, no explanation, no markdown, no backticks

FORMAT (return exactly this structure):
[
  {{"id": 1, "text": "question here", "category": "technical"}},
  {{"id": 2, "text": "question here", "category": "behavioral"}},
  {{"id": 3, "text": "question here", "category": "resume-specific"}}
]

Valid categories: technical, behavioral, resume-specific"""

    # Step 3: call Groq
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        questions_data = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(f"Groq returned invalid JSON: {raw}")

    return [Question(**q) for q in questions_data]