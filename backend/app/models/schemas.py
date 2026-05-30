from pydantic import BaseModel
from typing import Optional

class IngestResponse(BaseModel):
    session_id: str
    chunks_stored: int
    message: str

class GenerateQuestionsRequest(BaseModel):
    session_id: str
    job_description: str

class Question(BaseModel):
    id: int
    text: str
    category: str

class GenerateQuestionsResponse(BaseModel):
    session_id: str
    questions: list[Question]

class Feedback(BaseModel):
    score: int
    strengths: list[str]
    improvements: list[str]
    ideal_answer_hint: str

class EvaluateAnswerResponse(BaseModel):
    question_id: int
    feedback: Feedback