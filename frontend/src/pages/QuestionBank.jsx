import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import api from '../api/axios.js';

const emptyQuestion = {
  questionSet: '',
  type: 'mcq',
  subject: '',
  chapter: '',
  difficulty: 'easy',
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  marks: 1,
};

const prepareQuestionForm = (question) => ({
  ...emptyQuestion,
  ...question,
  options: [...(question.options || []), '', '', '', ''].slice(0, 4),
});

const QuestionBank = () => {
  const [questions, setQuestions] = useState([]);
  const [questionSets, setQuestionSets] = useState([]);
  const [ungroupedQuestionCount, setUngroupedQuestionCount] = useState(0);
  const [activeSet, setActiveSet] = useState(null);
  const [filters, setFilters] = useState({ subject: '', chapter: '', type: '', search: '' });
  const [selected, setSelected] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(emptyQuestion);
  const [pasteMode, setPasteMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [setModal, setSetModal] = useState(null);
  const [setTitle, setSetTitle] = useState('');
  const [error, setError] = useState('');

  const allQuestionIds = useMemo(() => questions.map((question) => question._id), [questions]);
  const allSelected = allQuestionIds.length > 0 && allQuestionIds.every((id) => selected.includes(id));

  const load = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      if (activeSet?._id) params.questionSet = activeSet._id;
      const { data } = await api.get('/questions', { params });
      setQuestions(data.questions);
      setSelected((current) => current.filter((id) => data.questions.some((question) => question._id === id)));
    } catch (err) {
      setError('Failed to load question bank');
    }
  };

  const loadSets = async () => {
    try {
      const { data } = await api.get('/questions/sets');
      setQuestionSets(data.questionSets);
      setUngroupedQuestionCount(data.ungroupedQuestionCount || 0);
      setActiveSet((current) => current ? data.questionSets.find((set) => set._id === current._id) || null : null);
    } catch {
      setError('Failed to load Question Sets');
    }
  };

  useEffect(() => { load(); }, [filters, activeSet?._id]);
  useEffect(() => { loadSets(); }, []);

  const toggleSelect = (id) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const toggleSelectAll = () => {
    setSelected(allSelected ? [] : allQuestionIds);
  };

  const openQuestion = (question) => {
    setActiveQuestion(question);
    setForm(prepareQuestionForm(question));
    setIsEditing(false);
    setError('');
  };

  const closeQuestion = () => {
    setActiveQuestion(null);
    setForm(emptyQuestion);
    setIsEditing(false);
  };

  const openAddQuestion = () => {
    if (!activeSet) return setError('Open a Question Set before adding questions.');
    setForm({ ...emptyQuestion, questionSet: activeSet._id });
    setActiveQuestion(null);
    setIsEditing(true);
    setShowAdd(true);
    setError('');
  };

  const saveQuestionSet = async (e) => {
    e.preventDefault();
    try {
      const { data } = setModal?.questionSet
        ? await api.put(`/questions/sets/${setModal.questionSet._id}`, { title: setTitle })
        : await api.post('/questions/sets', { title: setTitle });
      const saved = data.questionSet;
      if (setModal?.moveSelected) {
        await api.patch('/questions/assign-set', { ids: selected, questionSet: saved._id });
        setSelected([]);
      }
      setSetModal(null);
      setSetTitle('');
      await loadSets();
      if (!setModal?.questionSet) setActiveSet(saved);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save Question Set');
    }
  };

  const removeQuestionSet = async (questionSet) => {
    if (!window.confirm(`Delete “${questionSet.title}”? Its questions will be kept, but no longer grouped.`)) return;
    try {
      const { data } = await api.delete(`/questions/sets/${questionSet._id}`);
      setActiveSet(null);
      await Promise.all([loadSets(), load()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete Question Set');
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    await api.delete('/questions', { data: { ids: selected } });
    setSelected([]);
    load();
  };

  const validateQuestion = () => {
    if (form.type === 'mcq') {
      if (!form.correctAnswer) return 'Please select the correct answer.';
      if (!form.options.includes(form.correctAnswer)) return 'Correct answer must be one of the options.';
    }
    return '';
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();

    const validationError = validateQuestion();
    if (validationError) return setError(validationError);

    const payload = {
      ...form,
      options: form.type === 'mcq' ? form.options : [],
      correctAnswer: form.correctAnswer.trim(),
    };

    try {
      setError('');
      if (activeQuestion?._id) {
        const { data } = await api.put(`/questions/${activeQuestion._id}`, payload);
        setActiveQuestion(data.question);
        setForm(prepareQuestionForm(data.question));
        setIsEditing(false);
      } else {
        await api.post('/questions', payload);
        setShowAdd(false);
        setForm(emptyQuestion);
      }
      load();
      loadSets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save question');
    }
  };

  const handleParsePasted = async () => {
    try {
      const { data } = await api.post('/questions/parse-pasted', { rawText });
      for (const q of data.questions) {
        await api.post('/questions', { ...q, questionSet: activeSet?._id, subject: filters.subject || 'General', chapter: filters.chapter || 'General', difficulty: 'medium' });
      }
      setPasteMode(false);
      setRawText('');
      load();
      loadSets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to parse pasted questions');
    }
  };

  const renderQuestionForm = (title, onCancel) => (
    <form onSubmit={handleSaveQuestion} className="card p-4 md:p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
      <h3 className="font-semibold text-lg">{title}</h3>
      <textarea
        required
        placeholder="Question text"
        className="input-field"
        rows={4}
        value={form.questionText}
        onChange={(e) => setForm({ ...form, questionText: e.target.value })}
      />
      <select required className="input-field" value={form.questionSet} onChange={(e) => setForm({ ...form, questionSet: e.target.value })}>
        <option value="">Select Test Title / Question Set</option>
        {questionSets.map((set) => <option key={set._id} value={set._id}>{set.title}</option>)}
      </select>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input required placeholder="Subject" className="input-field" value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <input required placeholder="Chapter" className="input-field" value={form.chapter}
          onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, correctAnswer: '' })}>
          <option value="mcq">MCQ</option>
          <option value="true_false">True/False</option>
          <option value="fill_blank">Fill in the Blank</option>
          <option value="assertion_reason">Assertion & Reason</option>
        </select>
        <input type="number" min="1" className="input-field" value={form.marks}
          onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} />
      </div>
      {form.type === 'mcq' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {form.options.map((opt, i) => (
              <input
                key={i}
                placeholder={`Option ${i + 1}`}
                className="input-field"
                value={opt}
                onChange={(e) => {
                  const opts = [...form.options];
                  opts[i] = e.target.value;
                  setForm({ ...form, options: opts, correctAnswer: form.correctAnswer === opt ? e.target.value : form.correctAnswer });
                }}
              />
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Select Correct Answer</label>
            <div className="space-y-2">
              {form.options.map((option, index) => (
                <label key={index} className="flex items-center gap-3 rounded-lg border border-white/10 bg-surface p-2 cursor-pointer">
                  <input
                    type="radio"
                    name="correctAnswer"
                    value={option}
                    checked={form.correctAnswer === option}
                    onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                  />
                  <span className="text-sm">
                    <strong>{String.fromCharCode(65 + index)}.</strong> {option || `Option ${index + 1}`}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      {form.type !== 'mcq' && (
        <input
          required
          placeholder="Correct answer"
          className="input-field"
          value={form.correctAnswer}
          onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
        />
      )}
      <textarea placeholder="Explanation (optional)" className="input-field" rows={2} value={form.explanation}
        onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn-accent flex-1">Save</button>
      </div>
    </form>
  );

  return (
    <div className="teacher-layout">
      <Sidebar />
      <main className="teacher-main">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">Question Bank</h1>
            {activeSet && <p className="text-muted text-sm mt-1">{activeSet.title} · {activeSet.questionCount} question(s)</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            {!activeSet ? (
              <button className="btn-accent" onClick={() => { setSetTitle(''); setSetModal({}); }}>+ New Question Set</button>
            ) : activeSet._id === 'ungrouped' ? null : (
              <>
                <button className="btn-ghost" onClick={() => setPasteMode(true)}>Paste Questions</button>
                <button className="btn-accent" onClick={openAddQuestion}>+ Add Question</button>
              </>
            )}
          </div>
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        {!activeSet ? (
          <div className="space-y-3">
            {questionSets.map((set) => (
              <div key={set._id} className="card p-4 flex items-center gap-3">
                <button type="button" className="flex-1 text-left" onClick={() => { setActiveSet(set); setSelected([]); }}>
                  <p className="font-semibold">{set.title}</p>
                  <p className="text-muted text-sm mt-1">{set.questionCount} question(s)</p>
                </button>
                <button className="btn-ghost text-sm" onClick={() => { setSetTitle(set.title); setSetModal({ questionSet: set }); }}>Edit</button>
                <button className="btn-ghost text-danger text-sm" onClick={() => removeQuestionSet(set)}>Delete</button>
              </div>
            ))}
            {ungroupedQuestionCount > 0 && (
              <div className="card p-4 flex items-center gap-3">
                <button type="button" className="flex-1 text-left" onClick={() => { setActiveSet({ _id: 'ungrouped', title: 'Ungrouped Questions', questionCount: ungroupedQuestionCount }); setSelected([]); }}>
                  <p className="font-semibold">Ungrouped Questions</p>
                  <p className="text-muted text-sm mt-1">{ungroupedQuestionCount} question(s) created before Question Sets</p>
                </button>
              </div>
            )}
            {questionSets.length === 0 && <p className="text-muted text-sm">Create a Question Set (Test Title) to start organising questions.</p>}
          </div>
        ) : <>
        <div className="flex items-center justify-between mb-4">
          <button className="btn-ghost text-sm" onClick={() => { setActiveSet(null); setSelected([]); }}>← All Question Sets</button>
          {activeSet._id !== 'ungrouped' && <div className="flex gap-2"><button className="btn-ghost text-sm" onClick={() => { setSetTitle(activeSet.title); setSetModal({ questionSet: activeSet }); }}>Edit Title</button><button className="btn-ghost text-danger text-sm" onClick={() => removeQuestionSet(activeSet)}>Delete Set</button></div>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <input placeholder="Subject" className="input-field" value={filters.subject}
            onChange={(e) => setFilters({ ...filters, subject: e.target.value })} />
          <input placeholder="Chapter" className="input-field" value={filters.chapter}
            onChange={(e) => setFilters({ ...filters, chapter: e.target.value })} />
          <select className="input-field" value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">Any Type</option>
            <option value="mcq">MCQ</option>
            <option value="true_false">True/False</option>
            <option value="fill_blank">Fill in the Blank</option>
            <option value="assertion_reason">Assertion & Reason</option>
          </select>
          <input placeholder="Search..." className="input-field" value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>

        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={allSelected} disabled={questions.length === 0} onChange={toggleSelectAll} />
            Select all questions
          </label>
          {selected.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-muted text-sm">{selected.length} selected</span>
              {activeSet._id === 'ungrouped' && (
                <button className="btn-accent text-sm" onClick={() => { setSetTitle(''); setSetModal({ moveSelected: true }); }}>
                  Create Set from Selected
                </button>
              )}
              <button className="btn-ghost text-danger text-sm" onClick={handleBulkDelete}>Bulk Delete</button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {questions.map((q, index) => (
            <div key={q._id} className="card p-4 flex gap-4 items-start">
              <input type="checkbox" className="mt-1" checked={selected.includes(q._id)} onChange={() => toggleSelect(q._id)} />
              <button type="button" className="flex-1 text-left" onClick={() => openQuestion(q)}>
                <div className="flex gap-2 text-xs text-muted mb-1 flex-wrap">
                  <span className="bg-surface px-2 py-0.5 rounded">Q{index + 1}</span>
                  <span className="bg-surface px-2 py-0.5 rounded">{q.subject}</span>
                  <span className="bg-surface px-2 py-0.5 rounded">{q.chapter}</span>
                  <span className="bg-surface px-2 py-0.5 rounded">{q.marks} mark(s)</span>
                </div>
                <p className="text-sm line-clamp-2">{index + 1}. {q.questionText}</p>
              </button>
            </div>
          ))}
          {questions.length === 0 && <p className="text-muted text-sm">No questions match these filters yet.</p>}
        </div>
        </>}

        {showAdd && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            {renderQuestionForm('Add Question', () => setShowAdd(false))}
          </div>
        )}

        {activeQuestion && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            {isEditing ? (
              renderQuestionForm('Edit Question', closeQuestion)
            ) : (
              <div className="card p-4 md:p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-lg">Question Details</h3>
                  <button className="btn-ghost text-sm" onClick={() => setIsEditing(true)}>Edit</button>
                </div>
                <div className="flex gap-2 text-xs text-muted flex-wrap">
                  <span className="bg-surface px-2 py-0.5 rounded">{activeQuestion.subject}</span>
                  <span className="bg-surface px-2 py-0.5 rounded">{activeQuestion.chapter}</span>
                  <span className="bg-surface px-2 py-0.5 rounded">{activeQuestion.type}</span>
                  <span className="bg-surface px-2 py-0.5 rounded">{activeQuestion.marks} mark(s)</span>
                </div>
                <p className="text-base whitespace-pre-wrap">{activeQuestion.questionText}</p>
                {activeQuestion.options?.length > 0 && (
                  <div className="space-y-2">
                    {activeQuestion.options.map((option, index) => (
                      <p key={index} className="rounded-lg bg-surface p-2 text-sm">
                        <strong>{String.fromCharCode(65 + index)}.</strong> {option}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-sm"><span className="text-muted">Correct answer:</span> {activeQuestion.correctAnswer}</p>
                {activeQuestion.explanation && (
                  <p className="text-sm"><span className="text-muted">Explanation:</span> {activeQuestion.explanation}</p>
                )}
                <button className="btn-ghost w-full" onClick={closeQuestion}>Close</button>
              </div>
            )}
          </div>
        )}

        {pasteMode && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card p-6 w-full max-w-lg space-y-3">
              <h3 className="font-semibold text-lg">Paste Questions</h3>
              <p className="text-sm"><span className="text-muted">Test Title:</span> {activeSet?.title}</p>
              <p className="text-muted text-sm">Paste questions (from ChatGPT or elsewhere). Separate each question with a blank line.</p>
              <textarea rows={10} className="input-field" value={rawText} onChange={(e) => setRawText(e.target.value)}
                placeholder={'1) What is Newton\'s second law?\nA)F=ma\nB)E=mc^2\nAnswer: A)F=ma'} />
              <div className="flex gap-3">
                <button className="btn-ghost flex-1" onClick={() => setPasteMode(false)}>Cancel</button>
                <button className="btn-accent flex-1" onClick={handleParsePasted}>Import</button>
              </div>
            </div>
          </div>
        )}

        {setModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form onSubmit={saveQuestionSet} className="card p-6 w-full max-w-md space-y-4">
              <h3 className="font-semibold text-lg">{setModal.questionSet ? 'Edit Question Set' : setModal.moveSelected ? 'Create Set from Selected Questions' : 'New Question Set'}</h3>
              <p className="text-muted text-sm">{setModal.moveSelected ? `${selected.length} selected question(s) will be moved into this Test Title.` : 'Use a Test Title to group questions, such as “Unit Test 1” or “Revision Test”.'}</p>
              <input autoFocus required placeholder="Test Title" className="input-field" value={setTitle} onChange={(e) => setSetTitle(e.target.value)} />
              <div className="flex gap-3"><button type="button" className="btn-ghost flex-1" onClick={() => setSetModal(null)}>Cancel</button><button className="btn-accent flex-1">Save</button></div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default QuestionBank;
