import axios from 'axios';

// In Docker, nginx proxies /api/* to backend
// In dev, talk directly to localhost:8000
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function ingestResume(resumeFile, jobDescription) {
  const form = new FormData();
  form.append('resume', resumeFile);
  form.append('job_description', jobDescription);
  const res = await axios.post(`${BASE}/ingest`, form);
  return res.data;
}

export async function getQuestions(sessionId, jobDescription) {
  const res = await axios.post(`${BASE}/questions`, {
    session_id: sessionId,
    job_description: jobDescription,
  });
  return res.data.questions;
}

export async function evaluateAnswer(sessionId, questionId, questionText, answer) {
  const res = await axios.post(`${BASE}/evaluate`, {
    session_id: sessionId,
    question_id: questionId,
    question_text: questionText,
    answer,
  });
  return res.data.feedback;
}