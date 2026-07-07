import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';

const StudentJoin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', rollNumber: '', className: '', section: '', classCode: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
          <input required name="name" placeholder="Your Name" className="input-field" onChange={handleChange} />
          <input required name="rollNumber" placeholder="Roll Number" className="input-field" onChange={handleChange} />
          <input required name="className" placeholder="Class (e.g. XII)" className="input-field" onChange={handleChange} />
          <input required name="section" placeholder="Section (e.g. A)" className="input-field" onChange={handleChange} />
          <input required name="classCode" placeholder="Class Code" className="input-field" onChange={handleChange} />
          <button className="btn-accent w-full">Join Class</button>
        </form>
      </div>
    </div>
  );
};

export default StudentJoin;
