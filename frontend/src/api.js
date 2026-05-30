import axios from 'axios';

const BASE = 'http://localhost:8000';

export async function ingestResume(resumeFile, jobDescription) {
  const form = new FormData();
  form.append('resume', resumeFile);
  form.append('job_description', jobDescription);
  const res = await axios.post(`${BASE}/ingest`, form);
  return res.data; // { session_id, chunks_stored, message }
}

export async function getQuestions(sessionId, jobDescription) {
  const res = await axios.post(`${BASE}/questions`, {
    session_id: sessionId,
    job_description: jobDescription,
  });
  return res.data.questions; // list of { id, text, category }
}

export async function evaluateAnswer(sessionId, questionId, questionText, answer) {
  const res = await axios.post(`${BASE}/evaluate`, {
    session_id: sessionId,
    question_id: questionId,
    question_text: questionText,
    answer,
  });
  return res.data.feedback; // { score, strengths, improvements, ideal_answer_hint }
}