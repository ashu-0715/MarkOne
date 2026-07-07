import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';

const features = [
  { 
    title: 'Unlock Your Full Potential', 
    desc: 'Every single mark matters , one mark can change the result.' 
  },
  { 
    title: 'Master Every Concept', 
    desc: 'Do not underestimate one mark , success is built one point at a time.' 
  },
  { 
    title: 'Turn Effort Into Excellence', 
    desc: 'Great scores are not made by big answers alone, but by perfect one-mark answers.' 
  },
];
const steps = [
  { title: 'Create your class', desc: 'Teachers log in with an approved admin ID and share a class code with students.' },
  { title: 'Generate a test', desc: 'Paste a lesson, upload a PDF, or just type a prompt — AI builds the questions.' },
  { title: 'Review results', desc: 'See class and student-level reports the second results are in.' },
];

const LandingPage = () => {
  const [showLoginChoice, setShowLoginChoice] = useState(false);

  return (
    <div className="min-h-screen">
      <nav className="landing-nav flex items-center justify-between gap-4 px-8 py-5 max-w-7xl mx-auto">
        <span className="landing-brand font-display font-bold text-xl">
          Mark<span className="text-accent">One</span>
        </span>
        <div className="landing-nav-actions flex items-center gap-3">
          <Link to="/student/join" className="btn-ghost text-sm">Student Login</Link>
          <Link to="/teacher/login" className="btn-ghost text-sm">Teacher Login</Link>
          <button type="button" onClick={() => setShowLoginChoice(true)} className="btn-accent text-sm">Get Started</button>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto text-center px-6 pt-20 pb-24">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display font-extrabold text-4xl md:text-6xl leading-tight"
        >
          Don't lose your centum 
          <span className="text-accent"> by losing one mark</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-muted mt-6 text-lg max-w-2xl mx-auto"
        >
          - Experience Speaks😭<br></br>
          login👇🏻
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex items-center justify-center gap-4"
        >
          <button type="button" onClick={() => setShowLoginChoice(true)} className="btn-accent">Get Started</button>
          <Link to="/student/join" className="btn-ghost">Join as a Student</Link>
        </motion.div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {features.map((f) => (
          <div key={f.title} className="card p-6 hover:shadow-glow transition-shadow">
            <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="font-display font-bold text-2xl text-center mb-10">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="card p-6">
              <span className="text-accent font-display font-bold text-2xl">{i + 1}</span>
              <h3 className="font-semibold mt-2 mb-1">{s.title}</h3>
              <p className="text-muted text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-muted text-sm">
        © {new Date().getFullYear()} Created by ASH - your senior😄.
      </footer>

      {showLoginChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display font-bold text-xl">Choose Login</h2>
                <p className="text-muted text-sm mt-1">Teachers need an approved admin unique ID.</p>
              </div>
              <button
                type="button"
                className="text-muted hover:text-white"
                onClick={() => setShowLoginChoice(false)}
                aria-label="Close login choices"
              >
                X
              </button>
            </div>
            <div className="grid gap-3">
              <Link to="/student/join" className="btn-ghost text-center">Student Login</Link>
              <Link to="/teacher/login" className="btn-accent text-center">Teacher Login</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
