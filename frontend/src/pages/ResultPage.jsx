import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios.js';

const motivationalLines = [
  "Great effort — keep building on this.",
  "Every test is a step forward. Nice work.",
  "You're making real progress — stay consistent.",
];

const ResultPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all');

  useEffect(() => {
    api.get(`/tests/${id}/result`)
      .then((res) => setResult(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load result'));
  }, [id]);

  if (error) return <div className="min-h-screen flex items-center justify-center text-danger">{error}</div>;
  if (!result) return <div className="min-h-screen flex items-center justify-center text-muted">Loading result...</div>;

  const { test, attempt, detailedAnswers, strongChapters, weakChapters } = result;
  const line = motivationalLines[Math.floor(Math.random() * motivationalLines.length)];
  const visibleAnswers = detailedAnswers
    .map((answer, index) => ({ answer, index }))
    .filter(({ answer }) => reviewFilter === 'all' || (reviewFilter === 'correct' ? answer.isCorrect : !answer.isCorrect));

  const downloadReport = async () => {
    try {
      setDownloading(true);
      const response = await api.get(`/tests/${id}/report/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${test.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'test'}-revision-report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not download the revision report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <button className="text-muted text-sm mb-6" onClick={() => navigate('/student/dashboard')}>← Back to dashboard</button>

      <div className="card p-5 sm:p-8 text-center mb-8">
        <p className="text-muted text-sm">{test.title}</p>
        <p className="font-display font-extrabold text-5xl my-3 text-accent">{attempt.percentage}%</p>
        <p className="text-muted">{attempt.score} / {test.totalMarks} marks</p>
        <p className="text-sm mt-4 text-white/80">{line}</p>
        <button className="btn-accent mt-5 text-sm" onClick={downloadReport} disabled={downloading}>
          {downloading ? 'Preparing report...' : 'Download PDF Report'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 mb-8">
        <div className="card p-4 sm:p-5 text-center"><p className="text-success text-2xl font-bold">{attempt.correctCount}</p><p className="text-muted text-xs">Correct</p></div>
        <div className="card p-4 sm:p-5 text-center"><p className="text-danger text-2xl font-bold">{attempt.wrongCount}</p><p className="text-muted text-xs">Wrong</p></div>
        <div className="card p-4 sm:p-5 text-center"><p className="text-warning text-2xl font-bold">{attempt.skippedCount}</p><p className="text-muted text-xs">Skipped</p></div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <div className="card p-4 sm:p-5">
          <h3 className="font-semibold text-success mb-3">Strong Chapters</h3>
          {strongChapters.length ? strongChapters.map((c) => <p key={c} className="text-sm text-muted">• {c}</p>) : <p className="text-sm text-muted">Keep going — none yet at 70%+.</p>}
        </div>
        <div className="card p-4 sm:p-5">
          <h3 className="font-semibold text-danger mb-3">Topics to Revise</h3>
          {weakChapters.length ? weakChapters.map((c) => <p key={c} className="text-sm text-muted">• {c}</p>) : <p className="text-sm text-muted">No major weak spots detected.</p>}
        </div>
      </div>

      {test.showAnswersAfterSubmission && (
        <div className="card p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h3 className="font-semibold">Answer Review</h3>
            <div className="flex gap-2 text-xs">
              {[['all', 'All'], ['review', 'To revise'], ['correct', 'Correct']].map(([value, label]) => (
                <button key={value} onClick={() => setReviewFilter(value)}
                  className={`rounded-full px-3 py-1.5 border ${reviewFilter === value ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-muted'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {visibleAnswers.map(({ answer: a, index: i }) => (
              <div key={i} className="border-b border-white/5 pb-4 last:border-0">
                <p className="text-sm mb-1">{i + 1}. {a.questionText}</p>
                <p className="text-xs text-muted">
                  Your answer: <span className={a.isCorrect ? 'text-success' : 'text-danger'}>{a.givenAnswer || 'Skipped'}</span>
                  {!a.isCorrect && <> · Correct: <span className="text-success">{a.correctAnswer}</span></>}
                </p>
                {a.explanation && <p className="text-xs text-muted mt-1">{a.explanation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultPage;
