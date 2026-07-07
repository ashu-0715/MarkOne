import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios.js';

const TestInterface = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState('');
  const questionStart = useRef(Date.now());
  const timeSpent = useRef({});

  useEffect(() => {
    api.get(`/tests/${id}/take`)
      .then((res) => {
        setTest(res.data.test);
        setSecondsLeft(res.data.test.timeLimitMinutes * 60);
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load test'));
  }, [id]);

  useEffect(() => {
    if (!test || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [test, secondsLeft]);

  useEffect(() => {
    if (test && secondsLeft === 0 && test.autoSubmit) handleSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const recordTime = () => {
    const q = test.questions[current];
    const elapsed = Math.round((Date.now() - questionStart.current) / 1000);
    timeSpent.current[q._id] = (timeSpent.current[q._id] || 0) + elapsed;
    questionStart.current = Date.now();
  };

  const goTo = (idx) => {
    recordTime();
    setCurrent(idx);
  };

  const handleAnswer = (value) => {
    setAnswers({ ...answers, [test.questions[current]._id]: value });
  };

  const handleSubmit = async (auto = false) => {
    recordTime();
    try {
      const payload = test.questions.map((q) => ({
        questionId: q._id,
        givenAnswer: answers[q._id] || null,
        timeTakenSeconds: timeSpent.current[q._id] || 0,
      }));
      await api.post(`/tests/${id}/submit`, { answers: payload, status: auto ? 'auto_submitted' : 'submitted' });
      navigate(`/student/result/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
    }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center text-danger">{error}</div>;
  if (!test) return <div className="min-h-screen flex items-center justify-center text-muted">Loading test...</div>;

  const q = test.questions[current];
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-b border-white/5 sticky top-0 bg-bg z-10">
        <h1 className="font-display font-semibold">{test.title}</h1>
        <span className={`font-mono text-lg ${secondsLeft < 60 ? 'text-danger' : 'text-accent'}`}>{mins}:{secs}</span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 sm:gap-6 p-4 sm:p-6 max-w-6xl mx-auto w-full">
        <div className="flex-1 card p-4 sm:p-6">
          <p className="text-muted text-sm mb-2">Question {current + 1} of {test.questions.length} · {q.marks} mark(s)</p>
          <p className="text-lg mb-6">{q.questionText}</p>
          {q.imageUrl && <img src={q.imageUrl} alt="question diagram" className="mb-6 rounded-xl max-w-full" />}

          {q.type === 'mcq' && (
            <div className="space-y-3">
              {q.options.map((opt, i) => (
                <label key={i} className={`block px-4 py-3 rounded-xl cursor-pointer border ${answers[q._id] === opt ? 'border-accent bg-accent/10' : 'border-white/10 bg-surface'}`}>
                  <input type="radio" className="hidden" checked={answers[q._id] === opt} onChange={() => handleAnswer(opt)} />
                  {opt}
                </label>
              ))}
            </div>
          )}
          {q.type === 'true_false' && (
            <div className="flex flex-col gap-3 sm:flex-row">
              {['True', 'False'].map((opt) => (
                <button key={opt} onClick={() => handleAnswer(opt)}
                  className={`flex-1 py-3 rounded-xl border ${answers[q._id] === opt ? 'border-accent bg-accent/10' : 'border-white/10 bg-surface'}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}
          {(q.type === 'fill_blank' || q.type === 'assertion_reason') && (
            <input className="input-field" placeholder="Your answer" value={answers[q._id] || ''}
              onChange={(e) => handleAnswer(e.target.value)} />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-8">
            <button className="btn-ghost" disabled={current === 0} onClick={() => goTo(current - 1)}>Previous</button>
            <button className="btn-ghost text-warning"
              onClick={() => setMarked({ ...marked, [q._id]: !marked[q._id] })}>
              {marked[q._id] ? 'Unmark' : 'Mark for Review'}
            </button>
            {current < test.questions.length - 1 ? (
              <button className="btn-accent" onClick={() => goTo(current + 1)}>Next</button>
            ) : (
              <button className="btn-accent" onClick={() => handleSubmit(false)}>Submit</button>
            )}
          </div>
        </div>

        <div className="w-full md:w-56 card p-4">
          <p className="text-muted text-xs mb-3">Question Palette</p>
          <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
            {test.questions.map((qq, i) => {
              const state = answers[qq._id] ? 'answered' : marked[qq._id] ? 'marked' : 'unanswered';
              const styles = {
                answered: 'bg-success text-black',
                marked: 'bg-warning text-black',
                unanswered: 'bg-surface text-muted',
              };
              return (
                <button key={qq._id} onClick={() => goTo(i)}
                  className={`h-9 rounded-lg text-sm font-medium ${styles[state]} ${current === i ? 'ring-2 ring-accent' : ''}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 h-1.5 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${((current + 1) / test.questions.length) * 100}%` }} />
          </div>
          <button className="btn-accent w-full mt-4 text-sm" onClick={() => handleSubmit(false)}>Submit Test</button>
        </div>
      </div>
    </div>
  );
};

export default TestInterface;
