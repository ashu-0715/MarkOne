import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/tests/available')
      .then((res) => setTests(res.data.tests))
      .catch(() => setError('Could not load your tests'));
  }, []);

  const upcoming = tests.filter((t) => !t.attempt);
  const completed = tests.filter((t) => t.attempt);
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, t) => s + (t.attempt.percentage || 0), 0) / completed.length)
    : 0;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl">Hi, {user?.name}</h1>
          <p className="text-muted text-sm">Roll No. {user?.rollNumber} · {user?.className} {user?.section}</p>
        </div>
        <button onClick={logout} className="btn-ghost">Log out</button>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 mb-8 sm:mb-10">
        <div className="card p-4 sm:p-5"><p className="text-muted text-xs">Upcoming Tests</p><p className="font-display font-bold text-3xl mt-2">{upcoming.length}</p></div>
        <div className="card p-4 sm:p-5"><p className="text-muted text-xs">Completed Tests</p><p className="font-display font-bold text-3xl mt-2">{completed.length}</p></div>
        <div className="card p-4 sm:p-5"><p className="text-muted text-xs">Average Score</p><p className="font-display font-bold text-3xl mt-2">{avgScore}%</p></div>
      </div>

      <div className="card p-4 sm:p-6 mb-6">
        <h2 className="font-semibold mb-4">Upcoming Tests</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted text-sm">Nothing new right now — check back soon.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((t) => (
              <div key={t._id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-muted text-xs">{t.subject} · {t.timeLimitMinutes} min · {t.totalMarks} marks</p>
                </div>
                <button className="btn-accent text-sm" onClick={() => navigate(`/student/test/${t._id}`)}>Start</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Completed Tests</h2>
        {completed.length === 0 ? (
          <p className="text-muted text-sm">No completed tests yet.</p>
        ) : (
          <div className="space-y-3">
            {completed.map((t) => (
              <div key={t._id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-surface rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-muted text-xs">{t.subject}</p>
                </div>
                <span className="text-accent font-semibold">{t.attempt.percentage}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
