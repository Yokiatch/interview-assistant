# 🎯 AI Interview Assistant

A RAG-based AI Interview Assistant that generates targeted interview questions from your resume and job description, evaluates your answers, and gives structured feedback with scores.

Built as a portfolio project to demonstrate RAG pipelines, FastAPI backend design, and full-stack development.

## Live Demo

> Coming soon — deployment in progress.

## Features

- 📄 Upload your resume as a PDF
- 📋 Paste any job description
- 🤖 Generates 5 targeted interview questions (technical, behavioral, resume-specific)
- ✍️ Answer each question in your own words
- 📊 Get a score (1–10), strengths, areas to improve, and an ideal answer hint
- 🔍 RAG-grounded evaluation — feedback is based on your actual resume and JD, not hallucinated

## Tech Stack

### Backend
- **FastAPI** — REST API
- **Groq (Llama 3.3 70B)** — question generation and answer evaluation
- **Gemini text-embedding-001** — document embeddings
- **Qdrant (in-memory)** — vector store for RAG retrieval
- **pypdf** — PDF text extraction

### Frontend
- **React + Vite** — UI
- **Axios** — API calls

## Project Structure

```
interview-assistant/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app and routes
│   │   ├── services/
│   │   │   ├── ingest.py           # PDF parsing, chunking, embedding
│   │   │   ├── question_gen.py     # RAG-based question generation
│   │   │   └── evaluator.py        # RAG-based answer evaluation
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic request/response schemas
│   │   └── core/
│   │       ├── config.py           # Environment config
│   │       └── vector_store.py     # Qdrant wrapper
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # All screens and UI logic
│   │   └── api.js                  # API service layer
│   └── package.json
├── docker-compose.yml
└── .env.example
```

## How It Works

```
PDF + Job Description
        │
        ▼
  Extract text → Chunk → Embed (Gemini) → Store in Qdrant (session-namespaced)
        │
        ▼
  Retrieve top-k chunks → Groq (Llama 3.3) → 5 targeted questions
        │
        ▼
  User answers → Retrieve chunks → Groq → Score + structured feedback
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Groq API key — [console.groq.com](https://console.groq.com)
- Gemini API key — [aistudio.google.com](https://aistudio.google.com)

### Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows
# source venv/bin/activate    # Mac/Linux

pip install -r requirements.txt
```

Create a `.env` file:

```
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
```

Run the server:

```bash
python -m uvicorn app.main:app --reload
```

API docs available at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/ingest` | Upload resume PDF + job description |
| POST | `/questions` | Generate interview questions |
| POST | `/evaluate` | Evaluate an answer and return feedback |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (for embeddings) |
| `GROQ_API_KEY` | Groq API key (for LLM calls) |

## Author

**Yokiatch** — [github.com/Yokiatch](https://github.com/Yokiatch)

Repository: [github.com/Yokiatch/interview-assistant](https://github.com/Yokiatch/interview-assistant)

## Docker

### Prerequisites
- Docker Desktop installed and running

### Run with Docker Compose

```bash
# From the project root
docker-compose up --build
```

- Frontend: `http://localhost`
- Backend API docs: `http://localhost:8000/docs`

```bash
# Stop containers
docker-compose down
```

### Individual containers

```bash
# Backend only
docker build -t interview-backend ./backend
docker run -p 8000:8000 --env-file ./backend/.env interview-backend

# Frontend only
docker build -t interview-frontend ./frontend
docker run -p 80:80 interview-frontend
```

> Make sure your `backend/.env` file has both `GEMINI_API_KEY` and `GROQ_API_KEY` set before running Docker.