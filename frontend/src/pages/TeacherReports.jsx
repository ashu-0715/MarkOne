import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import api from '../api/axios.js';

const TeacherReports = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [report, setReport] = useState(null);
  const [expandedStudentId, setExpandedStudentId] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const { data } = await api.get('/classes');
        setClasses(data.classes);
        if (data.classes.length) {
          setSelectedClassId(data.classes[0]._id);
        }
      } catch (err) {
        setError('Could not load classes');
      }
    };

    loadClasses();
  }, []);

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

  const reportCards = report ? [
    { label: 'Class Average', value: `${report.summary.classAverage}%` },
    { label: 'Attempts', value: report.summary.totalAttempts },
    { label: 'Attempted Students', value: `${report.summary.attemptedStudents}/${report.summary.totalStudents}` },
    { label: 'Joined Students', value: report.summary.joinedStudents ?? report.students.length },
  ] : [];

  const getMarksSummary = (studentReport) => {
    const scored = studentReport.attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
    const total = studentReport.attempts.reduce((sum, attempt) => sum + (attempt.totalMarks || 0), 0);
    return total > 0 ? `${scored}/${total} marks` : 'No marks yet';
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

  return (
    <div className="teacher-layout">
      <Sidebar />
      <main className="teacher-main">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">Reports</h1>
            <p className="text-muted text-sm mt-1">Review class and student-level performance.</p>
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

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        <section className="card p-4 md:p-5">
          {loadingReport ? (
            <p className="text-muted text-sm">Loading report...</p>
          ) : report ? (
            <>
              <div className="report-summary-grid grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-5">
                {reportCards.map((card) => (
                  <div key={card.label} className="bg-surface rounded-lg p-3 border border-white/5">
                    <p className="text-muted text-[0.65rem] uppercase tracking-wide">{card.label}</p>
                    <p className="font-display font-bold text-lg md:text-xl mt-1">{card.value}</p>
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
            <p className="text-muted text-sm">Create a class first to generate reports.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default TeacherReports;
