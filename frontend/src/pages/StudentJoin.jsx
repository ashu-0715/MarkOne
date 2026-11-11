import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';

const StudentJoin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ className: '', registerNumber: '', classCode: '' });
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!form.className) { setStudents([]); setError(''); return; }
    const controller = new AbortController();
    api.get('/auth/student/roster', { params: { className: form.className }, signal: controller.signal })
      .then(({ data }) => {
        const roster = data.students || [];
        setStudents(roster);
        setForm((current) => current.registerNumber && !roster.some((student) => student.registerNumber === current.registerNumber)
          ? { ...current, registerNumber: '' }
          : current);
        setError('');
      })
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return;
        setStudents([]);
        setError('Could not load the official student list');
      });
    return () => controller.abort();
  }, [form.className]);

  const selectedStudent = students.find((student) => student.registerNumber === form.registerNumber);
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'className') {
      setStudents([]);
      setError('');
    }
    setForm((current) => name === 'className'
      ? { ...current, className: value, registerNumber: '' }
      : { ...current, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/student/join', form);
      login(data.token, data.student, 'student');
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not join');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <Link to="/" className="text-muted text-sm hover:text-white">← Back home</Link>
        <h1 className="font-display font-bold text-2xl mt-4 mb-2">Join Your Class</h1>
        <p className="text-muted text-sm mb-6">No password needed — just your class code.</p>
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <select required name="className" value={form.className} className="input-field" onChange={handleChange}>
            <option value="">Select Class</option>
            <option value="12A1">12A1</option>
            <option value="12A2">12A2</option>
          </select>
          <select required name="registerNumber" value={form.registerNumber} className="input-field" disabled={!form.className} onChange={handleChange}>
            <option value="">Select Roll Number</option>
            {students.map((student) => <option key={student.registerNumber} value={student.registerNumber}>{student.registerNumber}</option>)}
          </select>
          <input value={selectedStudent?.name || ''} placeholder="Student Name" className="input-field" readOnly aria-readonly="true" />
          <input required name="classCode" placeholder="Class Code" className="input-field" onChange={handleChange} />
          <button className="btn-accent w-full">Join Class</button>
        </form>
      </div>
    </div>
  );
};

export default StudentJoin;
