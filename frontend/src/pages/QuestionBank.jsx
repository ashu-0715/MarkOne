import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import api from '../api/axios.js';

const emptyQuestion = {
  type: 'mcq', subject: '', chapter: '', difficulty: 'easy',
  questionText: '', options: ['', '', '', ''], correctAnswer: '', explanation: '', marks: 1,
};

const QuestionBank = () => {
  const [questions, setQuestions] = useState([]);
  const [filters, setFilters] = useState({ subject: '', chapter: '', type: '', search: '' });
  const [selected, setSelected] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyQuestion);
  const [pasteMode, setPasteMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await api.get('/questions', { params });
      setQuestions(data.questions);
    } catch (err) {
      setError('Failed to load question bank');
    }
  };

  useEffect(() => { load(); }, [filters]);

  const toggleSelect = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    await api.delete('/questions', { data: { ids: selected } });
    setSelected([]);
    load();
  };

  const handleSaveQuestion = async (e) => {
  e.preventDefault();

  // Validation for MCQ
  if (form.type === "mcq") {
    if (!form.correctAnswer) {
      return setError("Please select the correct answer.");
    }

    if (!form.options.includes(form.correctAnswer)) {
      return setError("Correct answer must be one of the options.");
    }
  }

  try {
    setError("");

    await api.post("/questions", {
      ...form,
      correctAnswer: form.correctAnswer.trim(),
    });

    setShowAdd(false);
    setForm(emptyQuestion);
    load();
  } catch (err) {
    setError(err.response?.data?.message || "Failed to save question");
  }
};

  const handleParsePasted = async () => {
    try {
      const { data } = await api.post('/questions/parse-pasted', { rawText });
      for (const q of data.questions) {
        await api.post('/questions', { ...q, subject: filters.subject || 'General', chapter: filters.chapter || 'General', difficulty: 'medium' });
      }
      setPasteMode(false);
      setRawText('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to parse pasted questions');
    }
  };

  return (
    <div className="teacher-layout">
      <Sidebar />
      <main className="teacher-main">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="font-display font-bold text-2xl">Question Bank</h1>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button className="btn-ghost" onClick={() => setPasteMode(true)}>Paste Questions</button>
            <button className="btn-accent" onClick={() => setShowAdd(true)}>+ Add Question</button>
          </div>
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

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

        {selected.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-muted text-sm">{selected.length} selected</span>
            <button className="btn-ghost text-danger text-sm" onClick={handleBulkDelete}>Bulk Delete</button>
          </div>
        )}

        <div className="space-y-3">
          {questions.map((q) => (
            <label key={q._id} className="card p-4 flex gap-4 items-start cursor-pointer">
              <input type="checkbox" className="mt-1" checked={selected.includes(q._id)} onChange={() => toggleSelect(q._id)} />
              <div className="flex-1">
                <div className="flex gap-2 text-xs text-muted mb-1">
                  <span className="bg-surface px-2 py-0.5 rounded">{q.subject}</span>
                  <span className="bg-surface px-2 py-0.5 rounded">{q.chapter}</span>
                  <span className="bg-surface px-2 py-0.5 rounded">{q.marks} mark(s)</span>
                </div>
                <p className="text-sm">{q.questionText}</p>
              </div>
            </label>
          ))}
          {questions.length === 0 && <p className="text-muted text-sm">No questions match these filters yet.</p>}
        </div>

        {showAdd && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSaveQuestion} className="card p-4 md:p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
              <h3 className="font-semibold text-lg">Add Question</h3>
              <textarea required placeholder="Question text" className="input-field" rows={2}
                value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input required placeholder="Subject" className="input-field" value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                <input required placeholder="Chapter" className="input-field" value={form.chapter}
                  onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="mcq">MCQ</option>
                  <option value="true_false">True/False</option>
                  <option value="fill_blank">Fill in the Blank</option>
                  <option value="assertion_reason">Assertion & Reason</option>
                </select>
                <input type="number" min="1" className="input-field" value={form.marks}
                  onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} />
              </div>
              {form.type === 'mcq' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {form.options.map((opt, i) => (
                    <input key={i} placeholder={`Option ${i + 1}`} className="input-field" value={opt}
                      onChange={(e) => {
                        const opts = [...form.options];
                        opts[i] = e.target.value;
                        setForm({ ...form, options: opts });
                      }} />
                  ))}
                </div>
              )}
              {/* Correct Answer Selection */}
<div className="mt-3">
  <label className="block text-sm font-medium mb-2">
    Select Correct Answer
  </label>

  {form.options.map((option, index) => (
    <label
      key={index}
      className="flex items-center gap-3 p-2 border rounded-lg mb-2 cursor-pointer hover:bg-gray-50"
    >
      <input
        type="radio"
        name="correctAnswer"
        value={option}
        checked={form.correctAnswer === option}
        onChange={(e) =>
          setForm({
            ...form,
            correctAnswer: e.target.value,
          })
        }
      />

      <span>
        <strong>{String.fromCharCode(65 + index)}.</strong>{" "}
        {option || `Option ${index + 1}`}
      </span>
    </label>
  ))}
</div>

<textarea
  placeholder="Explanation (optional)"
  className="input-field"
  rows={2}
  value={form.explanation}
  onChange={(e) =>
    setForm({ ...form, explanation: e.target.value })
  }
/>

<div className="flex gap-3 pt-2">
  <button
    type="button"
    className="btn-ghost flex-1"
    onClick={() => setShowAdd(false)}
  >
    Cancel
  </button>

  <button className="btn-accent flex-1">
    Save
  </button>
</div>
              <textarea placeholder="Explanation (optional)" className="input-field" rows={2} value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-ghost flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn-accent flex-1">Save</button>
              </div>
            </form>
          </div>
        )}

        {pasteMode && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card p-6 w-full max-w-lg space-y-3">
              <h3 className="font-semibold text-lg">Paste Questions</h3>
              <p className="text-muted text-sm">Paste questions (from ChatGPT or elsewhere). Separate each question with a blank line.</p>
              <textarea rows={10} className="input-field" value={rawText} onChange={(e) => setRawText(e.target.value)}
                placeholder={'1) What is Newton\'s second law?\nA) F=ma\nB) E=mc^2\nAnswer: A'} />
              <div className="flex gap-3">
                <button className="btn-ghost flex-1" onClick={() => setPasteMode(false)}>Cancel</button>
                <button className="btn-accent flex-1" onClick={handleParsePasted}>Import</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default QuestionBank;
