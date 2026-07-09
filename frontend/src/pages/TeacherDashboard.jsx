import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import api from '../api/axios.js';

const TeacherDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [tests, setTests] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [showNewClass, setShowNewClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', subject: '', classCode: '' });
  const [viewingClass, setViewingClass] = useState(null);
  const [editingClass, setEditingClass] = useState(null);
  const [editClassForm, setEditClassForm] = useState({ name: '', subject: '', classCode: '' });
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
      } else if (selectedClassId && !loadedClasses.some((item) => item._id === selectedClassId)) {
        setSelectedClassId(loadedClasses[0]?._id || '');
      }
    } catch (err) {
      setError('Could not load dashboard data');
    }
  };

  useEffect(() => { loadData(); }, []);

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);
  const activeTests = tests.filter((t) => t.status === 'published').length;
  const viewingClassTests = viewingClass
    ? tests.filter((test) => String(test.class) === viewingClass._id)
    : [];
  const viewingQuestionCount = viewingClassTests.reduce((sum, test) => sum + (test.questions?.length || 0), 0);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      await api.post('/classes', newClass);
      setShowNewClass(false);
      setNewClass({ name: '', subject: '', classCode: '' });
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

  const openEditClass = (classItem) => {
    setEditingClass(classItem);
    setEditClassForm({ name: classItem.name, subject: classItem.subject, classCode: classItem.classCode });
    setError('');
  };

  const handleUpdateClass = async (e) => {
    e.preventDefault();
    if (!editingClass) return;

    try {
      await api.patch(`/classes/${editingClass._id}`, editClassForm);
      setEditingClass(null);
      setEditClassForm({ name: '', subject: '', classCode: '' });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update class');
    }
  };

  const handleDeleteClass = async (classItem) => {
    const confirmed = window.confirm(`Delete "${classItem.name}"? Students will no longer be able to join with this class code.`);
    if (!confirmed) return;

    try {
      await api.delete(`/classes/${classItem._id}`);
      if (selectedClassId === classItem._id) {
        setSelectedClassId('');
      }
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete class');
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
                  className={`flex flex-col gap-3 rounded-xl border p-3 transition sm:flex-row sm:items-stretch ${
                    selectedClassId === c._id
                      ? 'bg-accent/10 border-accent/50'
                      : 'bg-surface border-white/5 hover:border-white/15'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedClassId(c._id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted text-xs">{c.subject} | {c.studentCount} students</p>
                      </div>
                      <span className="font-mono text-accent text-xs">{c.classCode}</span>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                    <button
                      type="button"
                      onClick={() => setViewingClass(c)}
                      className="rounded-lg bg-accent/15 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/25"
                    >
                      View My Class
                    </button>
                    <button
                      type="button"
                      onClick={() => copyClassCode(c.classCode, c._id)}
                      className="rounded-lg bg-card px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                      aria-label={`Copy class code ${c.classCode}`}
                    >
                      {copiedClassId === c._id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditClass(c)}
                      className="rounded-lg bg-card px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClass(c)}
                      className="rounded-lg bg-danger/15 px-3 py-2 text-xs font-semibold text-danger transition hover:bg-danger/25"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showNewClass && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleCreateClass} className="card p-6 w-full max-w-sm space-y-3">
              <h3 className="font-semibold text-lg mb-2">Create Class</h3>
              <input required placeholder="Batch Name (e.g. XII A Physics)" className="input-field"
                value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} />
              <input required placeholder="Subject" className="input-field"
                value={newClass.subject} onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })} />
              <input required placeholder="Class Code (e.g. PHY12A)" className="input-field"
                value={newClass.classCode} onChange={(e) => setNewClass({ ...newClass, classCode: e.target.value.toUpperCase() })} />
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button type="button" className="btn-ghost flex-1" onClick={() => setShowNewClass(false)}>Cancel</button>
                <button className="btn-accent flex-1">Create</button>
              </div>
            </form>
          </div>
        )}

        {editingClass && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleUpdateClass} className="card p-6 w-full max-w-sm space-y-3">
              <h3 className="font-semibold text-lg mb-2">Edit Class</h3>
              <input
                required
                placeholder="Class Name"
                className="input-field"
                value={editClassForm.name}
                onChange={(e) => setEditClassForm({ ...editClassForm, name: e.target.value })}
              />
              <input
                required
                placeholder="Subject"
                className="input-field"
                value={editClassForm.subject}
                onChange={(e) => setEditClassForm({ ...editClassForm, subject: e.target.value })}
              />
              <input
                required
                placeholder="Class Code"
                className="input-field"
                value={editClassForm.classCode}
                onChange={(e) => setEditClassForm({ ...editClassForm, classCode: e.target.value.toUpperCase() })}
              />
              <p className="text-muted text-xs">Students must use the latest class code to join.</p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() => setEditingClass(null)}
                >
                  Cancel
                </button>
                <button className="btn-accent flex-1">Save</button>
              </div>
            </form>
          </div>
        )}

        {viewingClass && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-lg">{viewingClass.name}</h3>
                  <p className="text-muted text-xs mt-1">
                    {viewingClass.subject} | {viewingClass.classCode} | {viewingQuestionCount} selected question(s)
                  </p>
                </div>
                <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setViewingClass(null)}>
                  Close
                </button>
              </div>

              {viewingClassTests.length === 0 ? (
                <p className="text-muted text-sm">No tests have been created for this class yet.</p>
              ) : (
                <div className="space-y-4">
                  {viewingClassTests.map((test) => (
                    <div key={test._id} className="rounded-xl bg-surface border border-white/5 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3">
                        <div>
                          <p className="font-medium">{test.title}</p>
                          <p className="text-muted text-xs">
                            {test.status} | {test.questions?.length || 0} question(s) | {test.totalMarks} mark(s)
                          </p>
                        </div>
                      </div>

                      {test.questions?.length > 0 ? (
                        <div className="space-y-3">
                          {test.questions.map((question, index) => (
                            <div key={question._id || `${test._id}-${index}`} className="border-t border-white/5 pt-3">
                              <p className="text-xs text-muted mb-1">
                                Question {index + 1} | {question.chapter} | {question.marks} mark(s)
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{question.questionText}</p>
                              {question.imageUrl && (
                                <img src={question.imageUrl} alt="question diagram" className="mt-3 rounded-lg max-h-72 object-contain" />
                              )}
                              {question.options?.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {question.options.map((option, optionIndex) => (
                                    <p key={`${question._id}-${optionIndex}`} className="rounded-lg bg-card p-2 text-xs">
                                      {String.fromCharCode(65 + optionIndex)}. {option}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted text-sm">No questions were selected for this test.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;
