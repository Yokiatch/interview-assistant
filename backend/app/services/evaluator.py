import json
from groq import Groq
from app.core.config import settings
from app.core.vector_store import retrieve_chunks, embed_query
from app.models.schemas import Feedback

groq_client = Groq(api_key=settings.groq_api_key)


def evaluate_answer(
    session_id: str,
    question_text: str,
    answer: str,
) -> Feedback:
    # Step 1: embed the question + answer together for better retrieval
    query = f"{question_text} {answer}"
    query_vector = embed_query(query)
    chunks = retrieve_chunks(session_id, query_vector, top_k=settings.top_k_chunks)
    context = "\n\n---\n\n".join(chunks)

    # Step 2: build evaluation prompt
    prompt = f"""You are a strict but fair technical interviewer evaluating a candidate's answer.

INTERVIEW QUESTION:
{question_text}

CANDIDATE'S ANSWER:
{answer}

GROUNDING CONTEXT (resume + job description excerpts):
{context}

EVALUATION RULES:
- Score must be an integer from 1 to 10
- Strengths must reference specific things the candidate actually said
- Improvements must be concrete and actionable, not vague
- ideal_answer_hint should give direction without writing the full answer
- Base your evaluation on the grounding context — not on invented expectations
- Return ONLY a JSON object, no explanation, no markdown, no backticks

FORMAT (return exactly this structure):
{{
  "score": 7,
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["concrete improvement 1", "concrete improvement 2"],
  "ideal_answer_hint": "A strong answer would also mention..."
}}"""

    # Step 3: call Groq
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,  # lower temp for more consistent evaluation
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        feedback_data = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(f"Groq returned invalid JSON: {raw}")

    return Feedback(**feedback_data)