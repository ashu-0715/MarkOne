import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import api from '../api/axios.js';

const TeacherDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [tests, setTests] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [showNewClass, setShowNewClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', subject: '', className: '', section: '' });
  const [copiedClassId, setCopiedClassId] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [classesRes, testsRes] = await Promise.all([
        api.get('/classes'),
        api.get('/tests/mine'),
      ]);
      const loadedClasses = classesRes.data.classes;
      setClasses(loadedClasses);
      setTests(testsRes.data.tests);
      if (!selectedClassId && loadedClasses.length) {
        setSelectedClassId(loadedClasses[0]._id);
      }
    } catch (err) {
      setError('Could not load dashboard data');
    }
  };

  useEffect(() => { loadData(); }, []);

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);
  const activeTests = tests.filter((t) => t.status === 'published').length;

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      await api.post('/classes', newClass);
      setShowNewClass(false);
      setNewClass({ name: '', subject: '', className: '', section: '' });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create class');
    }
  };

  const copyClassCode = async (classCode, classId) => {
    try {
      await navigator.clipboard.writeText(classCode);
      setCopiedClassId(classId);
      setTimeout(() => setCopiedClassId(''), 1500);
    } catch (err) {
      setError('Could not copy class code');
    }
  };

  const cards = [
    { label: 'Total Tests', value: tests.length },
    { label: 'Active Tests', value: activeTests },
    { label: 'Total Students', value: totalStudents },
    { label: 'Classes', value: classes.length },
  ];

  return (
    <div className="teacher-layout">
      <Sidebar />
      <main className="teacher-main">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl">Dashboard</h1>
            <p className="text-muted text-sm mt-1">Manage classes and see a quick overview.</p>
          </div>
          <button className="btn-accent" onClick={() => setShowNewClass(true)}>+ New Class</button>
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        <div className="dashboard-stats grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-10">
          {cards.map((c) => (
            <div key={c.label} className="card p-4 md:p-5">
              <p className="text-muted text-xs uppercase tracking-wide">{c.label}</p>
              <p className="font-display font-bold text-2xl md:text-3xl mt-2">{c.value}</p>
            </div>
          ))}
        </div>

        <section className="card p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">My Classes</h2>
            <span className="text-muted text-xs">{classes.length} total</span>
          </div>
          {classes.length === 0 ? (
            <p className="text-muted text-sm">No classes yet. Create one to get a shareable class code for your students.</p>
          ) : (
            <div className="space-y-3">
              {classes.map((c) => (
                <div
                  key={c._id}
                  className={`flex items-stretch gap-2 rounded-xl border p-2 transition ${
                    selectedClassId === c._id
                      ? 'bg-accent/10 border-accent/50'
                      : 'bg-surface border-white/5 hover:border-white/15'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedClassId(c._id)}
                    className="min-w-0 flex-1 px-2 py-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted text-xs">{c.subject} | {c.studentCount} students</p>
                      </div>
                      <span className="font-mono text-accent text-xs">{c.classCode}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyClassCode(c.classCode, c._id)}
                    className="rounded-lg bg-card px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                    aria-label={`Copy class code ${c.classCode}`}
                  >
                    {copiedClassId === c._id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {showNewClass && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleCreateClass} className="card p-6 w-full max-w-sm space-y-3">
              <h3 className="font-semibold text-lg mb-2">Create Class</h3>
              <input required placeholder="Class Name (e.g. Physics XII A)" className="input-field"
                value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} />
              <input required placeholder="Subject" className="input-field"
                value={newClass.subject} onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })} />
              <input required placeholder="Class (e.g. XII)" className="input-field"
                value={newClass.className} onChange={(e) => setNewClass({ ...newClass, className: e.target.value })} />
              <input required placeholder="Section (e.g. A)" className="input-field"
                value={newClass.section} onChange={(e) => setNewClass({ ...newClass, section: e.target.value })} />
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button type="button" className="btn-ghost flex-1" onClick={() => setShowNewClass(false)}>Cancel</button>
                <button className="btn-accent flex-1">Create</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;
