import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import api from '../api/axios.js';

const CreateTest = () => {
  const [classes, setClasses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [config, setConfig] = useState({
    title: '',
    subject: '',
    class: '',
    chapter: '',
    timeLimitMinutes: '', // Changed from 30 to ''
    scheduleEnabled: false,
    scheduleStartDate: '',
    scheduleStartTime: '',
    scheduleEndDate: '',
    scheduleEndTime: '',
    negativeMarkingEnabled: false,
    negativeMarkingValue: 0.25,
    shuffleQuestions: true,
    shuffleOptions: true,
    autoSubmit: true,
    showAnswersAfterSubmission: true,
    allowRetest: false,
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedClass = useMemo(
    () => classes.find((item) => item._id === config.class),
    [classes, config.class]
  );

  useEffect(() => {
    api.get('/classes').then((res) => setClasses(res.data.classes));
    api.get('/questions', { params: { limit: 100 } }).then((res) => setQuestions(res.data.questions));
  }, []);

  const toggleQuestion = (id) =>
    setSelectedQuestions((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );

  const buildScheduleDateTime = (date, time) => {
    if (!date || !time) return '';
    return new Date(`${date}T${time}`).toISOString();
  };

  const submit = async (status) => {
    setError('');
    setMessage('');

    if (!config.class || selectedQuestions.length === 0) {
      return setError('Select a class and at least one question');
    }

    if (!config.timeLimitMinutes) {
      return setError('Please select a test duration');
    }

    let availableFrom = '';
    let availableUntil = '';
    if (config.scheduleEnabled) {
      const scheduleValues = [
        config.scheduleStartDate,
        config.scheduleStartTime,
        config.scheduleEndDate,
        config.scheduleEndTime,
      ];
      if (!scheduleValues.every(Boolean)) {
        return setError('Select both start and end date and time to schedule the test');
      }

      availableFrom = buildScheduleDateTime(config.scheduleStartDate, config.scheduleStartTime);
      availableUntil = buildScheduleDateTime(config.scheduleEndDate, config.scheduleEndTime);
      if (new Date(availableFrom) >= new Date(availableUntil)) {
        return setError('Schedule end must be after schedule start');
      }
    }

    try {
      const { data } = await api.post('/tests', {
        title: config.title,
        subject: config.subject,
        class: config.class,
        chapter: config.chapter,
        questions: selectedQuestions,
        timeLimitMinutes: Number(config.timeLimitMinutes),
        availableFrom: availableFrom || undefined,
        availableUntil: availableUntil || undefined,
        negativeMarking: {
          enabled: config.negativeMarkingEnabled,
          value: config.negativeMarkingValue,
        },
        shuffleQuestions: config.shuffleQuestions,
        shuffleOptions: config.shuffleOptions,
        autoSubmit: config.autoSubmit,
        showAnswersAfterSubmission: config.showAnswersAfterSubmission,
        allowRetest: config.allowRetest,
      });

      if (status === 'published') {
        await api.patch(`/tests/${data.test._id}/publish`);
        setMessage('Test published!');
      } else {
        setMessage('Draft saved.');
      }

      setSelectedQuestions([]);

      // Reset form
      setConfig({
        title: '',
        subject: '',
        class: '',
        chapter: '',
        timeLimitMinutes: '',
        scheduleEnabled: false,
        scheduleStartDate: '',
        scheduleStartTime: '',
        scheduleEndDate: '',
        scheduleEndTime: '',
        negativeMarkingEnabled: false,
        negativeMarkingValue: 0.25,
        shuffleQuestions: true,
        shuffleOptions: true,
        autoSubmit: true,
        showAnswersAfterSubmission: true,
        allowRetest: false,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save test');
    }
  };

  return (
    <div className="teacher-layout">
      <Sidebar />

      <main className="teacher-main max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl">
            Create Test
          </h1>
          <p className="text-muted text-sm mt-1">Build and publish a test for your selected class.</p>
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        {message && (
          <div className="publish-toast" role="status" aria-live="polite">
            <p className="font-semibold">{message}</p>
            <p className="text-xs text-white/75">Students can see it now.</p>
          </div>
        )}

        <div className="card p-6 mb-6 grid md:grid-cols-2 gap-4">
          <input
            placeholder="Test Title"
            className="input-field"
            value={config.title}
            onChange={(e) =>
              setConfig({ ...config, title: e.target.value })
            }
          />

          <input
            placeholder="Subject"
            className="input-field"
            value={config.subject}
            onChange={(e) =>
              setConfig({ ...config, subject: e.target.value })
            }
          />

          <select
            className="input-field"
            value={config.class}
            onChange={(e) =>
              setConfig({ ...config, class: e.target.value })
            }
          >
            <option value="">Select Class</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.classCode})
              </option>
            ))}
          </select>

          <div className="rounded-xl bg-surface border border-white/10 px-4 py-2.5">
  <p className="text-muted text-xs uppercase tracking-wide">
    Total Students
  </p>

  <input
    type="number"
    min="1"
    placeholder="Enter total students"
    value={config.totalStudents || ""}
    onChange={(e) =>
      setConfig({
        ...config,
        totalStudents: e.target.value,
      })
    }
    className="mt-2 w-full rounded-lg bg-black border border-white/10 px-3 py-2 text-white focus:border-primary outline-none"
  />
</div>

          <input
            placeholder="Chapter (optional)"
            className="input-field"
            value={config.chapter}
            onChange={(e) =>
              setConfig({ ...config, chapter: e.target.value })
            }
          />

          {/* Duration Dropdown */}
          <select
            className="input-field"
            value={config.timeLimitMinutes}
            onChange={(e) =>
              setConfig({
                ...config,
                timeLimitMinutes: e.target.value,
              })
            }
          >
            <option value="" disabled>
              Duration
            </option>
            <option value="5">5 Minutes</option>
            <option value="10">10 Minutes</option>
            <option value="15">15 Minutes</option>
            <option value="20">20 Minutes</option>
            <option value="30">30 Minutes</option>
            <option value="45">45 Minutes</option>
            <option value="60">60 Minutes</option>
            <option value="90">90 Minutes</option>
            <option value="120">120 Minutes</option>
            <option value="180">180 Minutes</option>
          </select>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={config.scheduleEnabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    scheduleEnabled: e.target.checked,
                    ...(!e.target.checked && {
                      scheduleStartDate: '',
                      scheduleStartTime: '',
                      scheduleEndDate: '',
                      scheduleEndTime: '',
                    }),
                  })
                }
              />
              Schedule Test (optional)
            </label>
          </div>

          {config.scheduleEnabled && (
            <div className="md:col-span-2 grid md:grid-cols-4 gap-4">
              <label className="text-xs text-muted">
                From Date
                <input
                  type="date"
                  className="input-field mt-1"
                  value={config.scheduleStartDate}
                  onChange={(e) => setConfig({ ...config, scheduleStartDate: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted">
                From Time
                <input
                  type="time"
                  className="input-field mt-1"
                  value={config.scheduleStartTime}
                  onChange={(e) => setConfig({ ...config, scheduleStartTime: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted">
                To Date
                <input
                  type="date"
                  className="input-field mt-1"
                  value={config.scheduleEndDate}
                  onChange={(e) => setConfig({ ...config, scheduleEndDate: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted">
                To Time
                <input
                  type="time"
                  className="input-field mt-1"
                  value={config.scheduleEndTime}
                  onChange={(e) => setConfig({ ...config, scheduleEndTime: e.target.value })}
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-center md:col-span-2 pt-2">
            {[
              ['negativeMarkingEnabled', 'Negative Marking'],
              ['shuffleQuestions', 'Shuffle Questions'],
              ['shuffleOptions', 'Shuffle Options'],
              ['autoSubmit', 'Auto Submit'],
              ['showAnswersAfterSubmission', 'Show Answers After Submission'],
              ['allowRetest', 'Allow Retest'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm text-muted"
              >
                <input
                  type="checkbox"
                  checked={config[key]}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      [key]: e.target.checked,
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold mb-4">
            Select Questions ({selectedQuestions.length} selected)
          </h2>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {questions.map((q) => (
              <label
                key={q._id}
                className="flex items-start gap-3 bg-surface rounded-xl p-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedQuestions.includes(q._id)}
                  onChange={() => toggleQuestion(q._id)}
                />

                <div>
                  <p className="text-sm">{q.questionText}</p>
                  <p className="text-xs text-muted">
                    {q.subject} · {q.chapter} · {q.marks} mark(s)
                  </p>
                </div>
              </label>
            ))}

            {questions.length === 0 && (
              <p className="text-muted text-sm">
                No questions in your bank yet — add some first.
              </p>
            )}
          </div>
        </div>

        <div className="create-test-actions flex gap-3 mt-6">
          <button
            className="btn-ghost"
            onClick={() => submit('draft')}
          >
            Save Draft
          </button>

          <button
            className="btn-accent"
            onClick={() => submit('published')}
          >
            Publish
          </button>
        </div>
      </main>
    </div>
  );
};

export default CreateTest;
