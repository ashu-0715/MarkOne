import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import api from '../api/axios.js';

const TeacherDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [tests, setTests] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [report, setReport] = useState(null);
  const [expandedStudentId, setExpandedStudentId] = useState('');
  const [showNewClass, setShowNewClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', subject: '', className: '', section: '' });
  const [copiedClassId, setCopiedClassId] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
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

  useEffect(() => {
    if (!selectedClassId) {
      setReport(null);
      return;
    }

    const loadReport = async () => {
      try {
        setLoadingReport(true);
        setError('');
        const res = await api.get(`/reports/class/${selectedClassId}`);
        setReport(res.data.analysis);
        setExpandedStudentId('');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load report');
      } finally {
        setLoadingReport(false);
      }
    };

    loadReport();
  }, [selectedClassId]);

  const selectedClass = useMemo(
    () => classes.find((item) => item._id === selectedClassId),
    [classes, selectedClassId]
  );

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

  const downloadPdf = async () => {
    if (!selectedClassId) return;
    try {
      setDownloadingPdf(true);
      setError('');
      const res = await api.get(`/reports/class/${selectedClassId}/export/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      const filename = `${selectedClass?.name || 'class'}-report.pdf`.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not download PDF report');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const cards = [
    { label: 'Total Tests', value: tests.length },
    { label: 'Active Tests', value: activeTests },
    { label: 'Total Students', value: totalStudents },
    { label: 'Classes', value: classes.length },
  ];

  const reportCards = report ? [
    { label: 'Class Average', value: `${report.summary.classAverage}%` },
    { label: 'Attempts', value: report.summary.totalAttempts },
    { label: 'Attempted Students', value: `${report.summary.attemptedStudents}/${report.summary.totalStudents}` },
    { label: 'Tests In Class', value: report.summary.totalTests },
  ] : [];

  const getMarksSummary = (studentReport) => {
    const scored = studentReport.attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
    const total = studentReport.attempts.reduce((sum, attempt) => sum + (attempt.totalMarks || 0), 0);
    return total > 0 ? `${scored}/${total} marks` : 'No marks yet';
  };

  return (
    <div className="teacher-layout">
      <Sidebar />
      <main className="teacher-main">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl">Dashboard</h1>
            <p className="text-muted text-sm mt-1">Generate class reports and review every student's analysis.</p>
          </div>
          <button className="btn-accent" onClick={() => setShowNewClass(true)}>+ New Class</button>
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-10">
          {cards.map((c) => (
            <div key={c.label} className="card p-4 md:p-5">
              <p className="text-muted text-xs uppercase tracking-wide">{c.label}</p>
              <p className="font-display font-bold text-2xl md:text-3xl mt-2">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[360px_1fr] gap-6">
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

          <section className="space-y-6">
            <div className="card p-4 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
                <div>
                  <h2 className="font-semibold">Reports</h2>
                  <p className="text-muted text-sm mt-1">{selectedClass?.name || 'Select a class'} complete analysis</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    className="input-field sm:w-64"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    disabled={!classes.length}
                  >
                    {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="btn-accent disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={downloadPdf}
                    disabled={!selectedClassId || downloadingPdf}
                  >
                    {downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
                  </button>
                </div>
              </div>

              {loadingReport ? (
                <p className="text-muted text-sm">Loading report...</p>
              ) : report ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
                    {reportCards.map((card) => (
                      <div key={card.label} className="bg-surface rounded-xl p-3 md:p-4 border border-white/5">
                        <p className="text-muted text-xs uppercase tracking-wide">{card.label}</p>
                        <p className="font-display font-bold text-xl md:text-2xl mt-2">{card.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {report.students.length === 0 ? (
                      <p className="text-muted text-sm">No students have joined this class yet.</p>
                    ) : report.students.map((studentReport) => {
                      const isExpanded = expandedStudentId === studentReport.student._id;
                      return (
                        <div key={studentReport.student._id} className="bg-surface rounded-xl border border-white/5 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedStudentId(isExpanded ? '' : studentReport.student._id)}
                            className="w-full p-4 text-left flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div>
                              <p className="font-semibold">{studentReport.student.name}</p>
                              <p className="text-muted text-xs">Roll {studentReport.student.rollNumber}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-card px-3 py-1 text-accent">{getMarksSummary(studentReport)}</span>
                              <span className="rounded-full bg-card px-3 py-1 text-white/80">{isExpanded ? 'Hide analysis' : 'View analysis'}</span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-4">
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="rounded-lg bg-card p-3">
                                  <p className="text-success text-xs uppercase tracking-wide mb-2">Strong Chapters</p>
                                  <p className="text-sm text-muted">{studentReport.strongChapters.join(', ') || 'None yet'}</p>
                                </div>
                                <div className="rounded-lg bg-card p-3">
                                  <p className="text-danger text-xs uppercase tracking-wide mb-2">Needs Revision</p>
                                  <p className="text-sm text-muted">{studentReport.weakChapters.join(', ') || 'No major weak spots'}</p>
                                </div>
                              </div>

                              {studentReport.attempts.length === 0 ? (
                                <p className="text-muted text-sm">No submitted tests yet.</p>
                              ) : studentReport.attempts.map((attempt) => (
                                <div key={attempt.attemptId} className="rounded-lg bg-card p-4">
                                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
                                    <div>
                                      <p className="font-medium">{attempt.testTitle}</p>
                                      <p className="text-muted text-xs">{attempt.score}/{attempt.totalMarks} marks | {attempt.averageTimePerQuestion}s avg per question</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <span className="text-success">{attempt.correctCount} correct</span>
                                      <span className="text-danger">{attempt.wrongCount} wrong</span>
                                      <span className="text-warning">{attempt.skippedCount} skipped</span>
                                    </div>
                                  </div>

                                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                                    {attempt.answers.map((answer, index) => (
                                      <div key={`${attempt.attemptId}-${answer.questionId}-${index}`} className="border-t border-white/5 pt-2">
                                        <p className="text-sm">{index + 1}. {answer.questionText}</p>
                                        <p className="text-xs text-muted mt-1">
                                          Chapter: {answer.chapter} | Answer: <span className={answer.isCorrect ? 'text-success' : 'text-danger'}>{answer.givenAnswer}</span>
                                          {!answer.isCorrect && <> | Correct: <span className="text-success">{answer.correctAnswer}</span></>}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-muted text-sm">Select a class to generate a report.</p>
              )}
            </div>
          </section>
        </div>

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
