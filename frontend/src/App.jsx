import { useState, useRef, useCallback, useEffect } from 'react';
import { ingestResume, getQuestions, evaluateAnswer, resumeSession } from './api';


// ── Design tokens ─────────────────────────────────────────────────────────────
const theme = {
  bg:        '#080c14',
  surface:   '#0d1424',
  surfaceHi: '#111d35',
  border:    '#1a2844',
  borderHi:  '#2a3f6a',
  text:      '#e8edf5',
  muted:     '#5a7099',
  accent:    '#3b82f6',
  accentHi:  '#60a5fa',
  green:     '#10b981',
  amber:     '#f59e0b',
  red:       '#ef4444',
  purple:    '#8b5cf6',
};

const catColor = {
  technical:       { fg: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)',  bar: '#3b82f6' },
  behavioral:      { fg: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)',  bar: '#10b981' },
  'resume-specific':{ fg: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', bar: '#8b5cf6' },
};

const SCREEN = { UPLOAD: 0, QUESTIONS: 1, ANSWER: 2, FEEDBACK: 3 };

// ── Global styles injected once ───────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: ${theme.bg};
    color: ${theme.text};
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.35); }
    70%  { box-shadow: 0 0 0 14px rgba(59,130,246,0); }
    100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes draw {
    to { stroke-dashoffset: 0; }
  }
  @keyframes scoreCount {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }

  .fade-up  { animation: fadeUp  0.45s cubic-bezier(.22,.68,0,1.2) both; }
  .fade-in  { animation: fadeIn  0.3s ease both; }

  .card-hover {
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .card-hover:hover {
    transform: translateY(-2px);
    border-color: ${theme.borderHi} !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }

  textarea, input[type="text"] {
    font-family: 'DM Sans', sans-serif;
  }

  .spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-right: 8px;
  }

  .score-ring circle {
    transition: stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1.2);
  }
`;


function injectStyles() {
  if (document.getElementById('aia-styles')) return;
  const s = document.createElement('style');
  s.id = 'aia-styles';
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}
injectStyles();

// ── Shared primitives ─────────────────────────────────────────────────────────
function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, marginBottom: 8 }}>{children}</div>;
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', color: '#fca5a5', fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16 }}>⚠</span> {msg}
    </div>
  );
}

function Badge({ category }) {
  const c = catColor[category] || catColor.technical;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: c.bg, border: `1px solid ${c.border}`, color: c.fg, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.fg, flexShrink: 0 }} />
      {category}
    </span>
  );
}

// Progress stepper
function Stepper({ step }) {
  const steps = ['Setup', 'Questions', 'Answer', 'Feedback'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40 }}>
      {steps.map((label, i) => {
        const active = i === step;
        const done   = i < step;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: done ? theme.green : active ? theme.accent : theme.surface,
                border: `2px solid ${done ? theme.green : active ? theme.accent : theme.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                color: done || active ? '#fff' : theme.muted,
                transition: 'all 0.3s ease',
                boxShadow: active ? `0 0 0 4px rgba(59,130,246,0.15)` : 'none',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 11, color: active ? theme.accentHi : done ? theme.green : theme.muted, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 60, height: 2, background: i < step ? theme.green : theme.border, margin: '0 4px', marginBottom: 18, transition: 'background 0.3s ease' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Screen 1: Upload ──────────────────────────────────────────────────────────
function UploadScreen({ onDone }) {
  const [file, setFile]       = useState(null);
  const [jd, setJd]           = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') setFile(f);
    else setError('Please drop a PDF file.');
  }, []);

  async function handleStart() {
    if (!file)         { setError('Please upload your resume PDF.'); return; }
    if (!jd.trim())    { setError('Please paste a job description.'); return; }
    setError(''); setLoading(true);
    try {
      const { session_id } = await ingestResume(file, jd);
      const questions = await getQuestions(session_id, jd);
      onDone({ sessionId: session_id, questions, jobDescription: jd });
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not connect to backend. Is it running on port 8000?');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px' }}>
      {/* Header */}
      <div className="fade-up" style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 100, padding: '6px 16px', marginBottom: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent, animation: 'pulse-ring 2s infinite' }} />
          <span style={{ fontSize: 12, color: theme.accentHi, fontWeight: 600, letterSpacing: '0.08em' }}>AI-POWERED • RAG-GROUNDED</span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 14 }}>
          Ace Your Next<br />
          <span style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Interview</span>
        </h1>
        <p style={{ color: theme.muted, fontSize: 16, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
          Upload your resume and paste a job description. We'll generate targeted questions and evaluate your answers in real time.
        </p>
      </div>

      <Stepper step={0} />

      <div className="fade-up" style={{ width: '100%', maxWidth: 560, animationDelay: '0.1s' }}>
        <ErrorBox msg={error} />

        {/* Drop zone */}
        <div style={{ marginBottom: 24 }}>
          <Label>Resume PDF</Label>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current.click()}
            style={{
              border: `2px dashed ${dragging ? theme.accent : file ? theme.green : theme.border}`,
              borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? 'rgba(59,130,246,0.05)' : file ? 'rgba(16,185,129,0.05)' : theme.surface,
              transition: 'all 0.2s ease',
            }}>
            <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>📄</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: theme.green, fontWeight: 600, fontSize: 14 }}>{file.name}</div>
                  <div style={{ color: theme.muted, fontSize: 12 }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⬆️</div>
                <div style={{ color: theme.text, fontWeight: 500, marginBottom: 4 }}>Drop your PDF here</div>
                <div style={{ color: theme.muted, fontSize: 13 }}>or click to browse</div>
              </div>
            )}
          </div>
        </div>

        {/* JD textarea */}
        <div style={{ marginBottom: 28 }}>
          <Label>Job Description</Label>
          <textarea
            rows={9}
            placeholder="Paste the full job description here — title, responsibilities, required skills..."
            value={jd}
            onChange={e => setJd(e.target.value)}
            style={{
              width: '100%', borderRadius: 12, border: `1px solid ${jd ? theme.borderHi : theme.border}`,
              background: theme.surface, color: theme.text, padding: '14px 16px',
              fontSize: 14, lineHeight: 1.7, resize: 'vertical', transition: 'border-color 0.2s',
              outline: 'none',
            }}
          />
          {jd && <div style={{ textAlign: 'right', color: theme.muted, fontSize: 12, marginTop: 4 }}>{jd.length} chars</div>}
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={loading}
          style={{
            width: '100%', padding: '16px', borderRadius: 12, border: 'none',
            background: loading ? theme.border : 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: loading ? 'none' : '0 4px 24px rgba(59,130,246,0.35)',
            transition: 'all 0.2s ease',
            fontFamily: 'Syne, sans-serif', letterSpacing: '0.02em',
          }}>
          {loading && <span className="spinner" />}
          {loading ? 'Analyzing resume & generating questions...' : 'Generate Interview Questions →'}
        </button>

        {/* Feature row */}
        {!loading && (
          <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
            {['RAG-grounded', 'Real-time eval', 'AI feedback'].map(t => (
              <div key={t} style={{ fontSize: 12, color: theme.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: theme.green }}>✓</span> {t}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Screen 2: Questions ───────────────────────────────────────────────────────
function QuestionsScreen({ questions, onSelect, onReset }) {
  const counts = questions.reduce((a, q) => { a[q.category] = (a[q.category] || 0) + 1; return a; }, {});

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px' }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: 640 }}>

        <Stepper step={1} />

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Your Interview Questions</h2>
            <p style={{ color: theme.muted, fontSize: 14 }}>Click any question to answer it and receive AI feedback.</p>
          </div>
          <button onClick={onReset} style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.muted, padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>← Start over</button>
        </div>

        {/* Category summary */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {Object.entries(counts).map(([cat, n]) => {
            const c = catColor[cat] || catColor.technical;
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: c.bg, border: `1px solid ${c.border}` }}>
                <span style={{ color: c.fg, fontSize: 12, fontWeight: 700 }}>{n}</span>
                <span style={{ color: c.fg, fontSize: 12, textTransform: 'capitalize' }}>{cat}</span>
              </div>
            );
          })}
        </div>

        {/* Question cards */}
        {questions.map((q, i) => {
          const c = catColor[q.category] || catColor.technical;
          return (
            <div
              key={q.id}
              className="card-hover fade-up"
              onClick={() => onSelect(q, i)}
              style={{
                background: theme.surface, border: `1px solid ${theme.border}`,
                borderLeft: `3px solid ${c.bar}`,
                borderRadius: 12, padding: '18px 20px', marginBottom: 12,
                cursor: 'pointer', animationDelay: `${i * 0.07}s`,
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: c.bg, border: `1px solid ${c.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 800, color: c.fg,
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 8 }}><Badge category={q.category} /></div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: theme.text }}>{q.text}</div>
                </div>
                <div style={{ color: theme.muted, fontSize: 18, alignSelf: 'center' }}>›</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Screen 3: Answer ──────────────────────────────────────────────────────────
function AnswerScreen({ question, questionIndex, total, sessionId, onFeedback, onBack }) {
  const [answer, setAnswer]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const c = catColor[question.category] || catColor.technical;
  const progress = ((questionIndex + 1) / total) * 100;

  async function handleSubmit() {
    if (!answer.trim()) { setError('Please write an answer before submitting.'); return; }
    setError(''); setLoading(true);
    try {
      const feedback = await evaluateAnswer(sessionId, question.id, question.text, answer);
      onFeedback(feedback, answer);
    } catch (e) {
      setError(e.response?.data?.detail || 'Evaluation failed. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px' }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: 640 }}>

        <Stepper step={2} />

        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: theme.muted }}>Question {questionIndex + 1} of {total}</span>
            <span style={{ fontSize: 12, color: theme.muted }}>{Math.round(progress)}% complete</span>
          </div>
          <div style={{ height: 4, background: theme.border, borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.purple})`, borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Question card */}
        <div style={{ background: theme.surface, border: `1px solid ${c.border}`, borderTop: `3px solid ${c.bar}`, borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}><Badge category={question.category} /></div>
          <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.65, color: '#fff' }}>{question.text}</div>
        </div>

        {/* Tip */}
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <span style={{ fontSize: 13, color: '#93c5fd', lineHeight: 1.5 }}>Structure your answer with a specific example. Aim for 2–3 minutes of speech time (~200–300 words).</span>
        </div>

        <ErrorBox msg={error} />

        {/* Answer textarea */}
        <div style={{ marginBottom: 20 }}>
          <Label>Your Answer</Label>
          <textarea
            rows={9}
            placeholder="Type your answer here..."
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            style={{
              width: '100%', borderRadius: 12, border: `1px solid ${answer ? theme.borderHi : theme.border}`,
              background: theme.surface, color: theme.text, padding: '14px 16px',
              fontSize: 15, lineHeight: 1.7, resize: 'vertical', outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: answer.split(/\s+/).filter(Boolean).length > 50 ? theme.green : theme.muted }}>
              {answer.split(/\s+/).filter(Boolean).length} words
            </span>
            <span style={{ fontSize: 12, color: theme.muted }}>{answer.length} chars</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.muted, padding: '13px 20px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 1, padding: '13px', borderRadius: 10, border: 'none',
              background: loading ? theme.border : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: loading ? 'none' : '0 4px 20px rgba(59,130,246,0.3)',
              fontFamily: 'Syne, sans-serif',
            }}>
            {loading && <span className="spinner" />}
            {loading ? 'Evaluating your answer...' : 'Submit & Get Feedback →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Score ring SVG ────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 54, stroke = 7;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 10) * circumference;
  const color = score >= 8 ? theme.green : score >= 5 ? theme.amber : theme.red;

  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 24px' }}>
      <svg width="140" height="140" className="score-ring" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke={theme.border} strokeWidth={stroke} />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1.2)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'scoreCount 0.6s 0.4s cubic-bezier(.22,.68,0,1.2) both' }}>
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 38, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 12, color: theme.muted, fontWeight: 500 }}>out of 10</span>
      </div>
    </div>
  );
}

// ── Screen 4: Feedback ────────────────────────────────────────────────────────
function FeedbackScreen({ feedback, question, onNext, onRetry, hasNext }) {
  const scoreLabel = feedback.score >= 8 ? 'Excellent' : feedback.score >= 6 ? 'Good' : feedback.score >= 4 ? 'Needs Work' : 'Keep Practicing';
  const scoreLabelColor = feedback.score >= 8 ? theme.green : feedback.score >= 6 ? theme.amber : theme.red;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px' }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: 620 }}>

        <Stepper step={3} />

        {/* Score card */}
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '32px 28px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: theme.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Your Score</div>
          <ScoreRing score={feedback.score} />
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, color: scoreLabelColor }}>{scoreLabel}</div>
        </div>

        {/* Strengths */}
        <div className="fade-up" style={{ background: theme.surface, border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: '20px 22px', marginBottom: 14, animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: theme.green }}>Strengths</span>
          </div>
          {feedback.strengths.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.06)', marginBottom: i < feedback.strengths.length - 1 ? 8 : 0 }}>
              <span style={{ color: theme.green, flexShrink: 0, marginTop: 1 }}>◆</span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: '#d1fae5' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Improvements */}
        <div className="fade-up" style={{ background: theme.surface, border: '1px solid rgba(245,158,11,0.2)', borderRadius: 16, padding: '20px 22px', marginBottom: 14, animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>↑</div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: theme.amber }}>Areas to Improve</span>
          </div>
          {feedback.improvements.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', marginBottom: i < feedback.improvements.length - 1 ? 8 : 0 }}>
              <span style={{ color: theme.amber, flexShrink: 0, marginTop: 1 }}>◆</span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: '#fde68a' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Ideal hint */}
        <div className="fade-up" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, padding: '20px 22px', marginBottom: 22, animationDelay: '0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💡</div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: theme.accentHi }}>Ideal Answer Hint</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: '#bfdbfe' }}>{feedback.ideal_answer_hint}</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onRetry} style={{ flex: 1, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.muted, padding: '13px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>↩ Retry</button>
          <button
            onClick={onNext}
            style={{
              flex: 2, padding: '13px', borderRadius: 10, border: 'none',
              background: hasNext ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 4px 20px ${hasNext ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}`,
              fontFamily: 'Syne, sans-serif',
            }}>
            {hasNext ? 'Next Question →' : '✓ Finish Interview'}
          </button>
        </div>
      </div>
    </div>
  );
}

const SESSION_KEY = 'interview_session_id';

function saveSessionLocally(sessionId) {
  localStorage.setItem(SESSION_KEY, sessionId);
}

function loadSessionLocally() {
  return localStorage.getItem(SESSION_KEY);
}

function clearSessionLocally() {
  localStorage.removeItem(SESSION_KEY);
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]           = useState(SCREEN.UPLOAD);
  const [sessionId, setSessionId]     = useState('');
  const [questions, setQuestions]     = useState([]);
  const [currentQ, setCurrentQ]       = useState(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [feedback, setFeedback]       = useState(null);
  const [resuming, setResuming]       = useState(true);


  useEffect(() => {
  async function tryResume() {
    const savedId = loadSessionLocally();
    if (!savedId) { setResuming(false); return; }
    try {
      const data = await resumeSession(savedId);
      setSessionId(data.session_id);
      setQuestions(data.questions);
      setScreen(SCREEN.QUESTIONS);
    } catch {
      clearSessionLocally();
    } finally {
      setResuming(false);
    }
    }
      tryResume();
    }, []);

  function handleIngestDone({ sessionId, questions }) {
    saveSessionLocally(sessionId);
    setSessionId(sessionId); setQuestions(questions);
    setScreen(SCREEN.QUESTIONS);
  }

  function handleSelectQuestion(q, idx) {
    setCurrentQ(q); setCurrentQIdx(idx); setFeedback(null);
    setScreen(SCREEN.ANSWER);
  }

  function handleFeedback(fb) {
    setFeedback(fb); setScreen(SCREEN.FEEDBACK);
  }

  function handleNext() {
    const next = currentQIdx + 1;
    if (next < questions.length) { setCurrentQ(questions[next]); setCurrentQIdx(next); setFeedback(null); setScreen(SCREEN.ANSWER); }
    else setScreen(SCREEN.QUESTIONS);
  }
  if (resuming) return (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7099', fontFamily: 'DM Sans, sans-serif' }}>
    Resuming session...
  </div>
  );

  return (
    <div style={{ background: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.08) 0%, transparent 70%), ${theme.bg}`, minHeight: '100vh' }}>
      {screen === SCREEN.UPLOAD    && <UploadScreen    onDone={handleIngestDone} />}
      {screen === SCREEN.QUESTIONS && <QuestionsScreen questions={questions} onSelect={handleSelectQuestion} onReset={() => {
  clearSessionLocally();
  setScreen(SCREEN.UPLOAD);
  setSessionId('');
  setQuestions([]);
}} />}
      {screen === SCREEN.ANSWER    && <AnswerScreen    question={currentQ} questionIndex={currentQIdx} total={questions.length} sessionId={sessionId} onFeedback={handleFeedback} onBack={() => setScreen(SCREEN.QUESTIONS)} />}
      {screen === SCREEN.FEEDBACK  && <FeedbackScreen  feedback={feedback} question={currentQ} onNext={handleNext} onRetry={() => setScreen(SCREEN.ANSWER)} hasNext={currentQIdx + 1 < questions.length} />}
    </div>
  );
}