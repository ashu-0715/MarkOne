import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';

const TeacherLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    teacherName: '',
    subject: '',
    uniqueId: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/teacher/login', form);
      login(data.token, data.teacher, 'teacher');
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <Link to="/" className="text-muted text-sm hover:text-white">Back home</Link>
        <h1 className="font-display font-bold text-2xl mt-4 mb-2">Teacher Login</h1>
        <p className="text-muted text-sm mb-6">Enter your name, subject, and admin unique ID.</p>
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            name="teacherName"
            placeholder="Teacher's Name"
            className="input-field"
            value={form.teacherName}
            onChange={handleChange}
          />
          <input
            required
            name="subject"
            placeholder="Subject Handling"
            className="input-field"
            value={form.subject}
            onChange={handleChange}
          />
          <input
            required
            name="uniqueId"
            placeholder="Admin Unique ID"
            className="input-field"
            value={form.uniqueId}
            onChange={handleChange}
          />
          <button className="btn-accent w-full">Log In</button>
        </form>
      </div>
    </div>
  );
};

export default TeacherLogin;
