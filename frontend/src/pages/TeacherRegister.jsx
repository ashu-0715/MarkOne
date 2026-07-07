import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

const TeacherRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // form -> otp -> done
  const [teacherId, setTeacherId] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '', institution: '', mobile: '', email: '',
    subjects: '', classesHandling: '', password: '', confirmPassword: '',
  });
  const [otp, setOtp] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    try {
      const { data } = await api.post('/auth/teacher/register', {
        ...form,
        subjects: form.subjects.split(',').map((s) => s.trim()).filter(Boolean),
        classesHandling: form.classesHandling.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setTeacherId(data.teacherId);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/teacher/verify-otp', { mobile: form.mobile, otp });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8">
        <Link to="/" className="text-muted text-sm hover:text-white">← Back home</Link>
        <h1 className="font-display font-bold text-2xl mt-4 mb-6">Teacher Registration</h1>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required name="fullName" placeholder="Full Name" className="input-field" onChange={handleChange} />
            <input required name="institution" placeholder="School / Institution Name" className="input-field" onChange={handleChange} />
            <input required name="mobile" placeholder="Mobile Number" className="input-field" onChange={handleChange} />
            <input name="email" placeholder="Email (optional)" className="input-field" onChange={handleChange} />
            <input required name="subjects" placeholder="Subjects (comma separated)" className="input-field" onChange={handleChange} />
            <input required name="classesHandling" placeholder="Classes Handling (comma separated)" className="input-field" onChange={handleChange} />
            <input required type="password" name="password" placeholder="Password" className="input-field" onChange={handleChange} />
            <input required type="password" name="confirmPassword" placeholder="Confirm Password" className="input-field" onChange={handleChange} />
            <button className="btn-accent w-full">Register</button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-muted text-sm">Enter the OTP sent to {form.mobile}</p>
            <input required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" className="input-field" />
            <button className="btn-accent w-full">Verify</button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <p className="text-success font-semibold">Registration Successful!</p>
            <p className="text-muted text-sm">Your permanent Teacher ID:</p>
            <div className="bg-surface rounded-xl px-4 py-3 font-mono text-lg">{teacherId}</div>
            <button
              className="btn-ghost w-full"
              onClick={() => navigator.clipboard.writeText(teacherId)}
            >
              Copy Teacher ID
            </button>
            <button className="btn-accent w-full" onClick={() => navigate('/teacher/login')}>
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherRegister;
