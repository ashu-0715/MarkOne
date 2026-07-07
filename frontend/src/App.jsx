import { Navigate, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import TeacherLogin from './pages/TeacherLogin.jsx';
import StudentJoin from './pages/StudentJoin.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import QuestionBank from './pages/QuestionBank.jsx';
import CreateTest from './pages/CreateTest.jsx';
import TeacherReports from './pages/TeacherReports.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import TestInterface from './pages/TestInterface.jsx';
import ResultPage from './pages/ResultPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/teacher/register" element={<Navigate to="/teacher/login" replace />} />
      <Route path="/teacher/login" element={<TeacherLogin />} />
      <Route path="/student/join" element={<StudentJoin />} />

      <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/question-bank" element={<ProtectedRoute allowedRole="teacher"><QuestionBank /></ProtectedRoute>} />
      <Route path="/teacher/create-test" element={<ProtectedRoute allowedRole="teacher"><CreateTest /></ProtectedRoute>} />
      <Route path="/teacher/reports" element={<ProtectedRoute allowedRole="teacher"><TeacherReports /></ProtectedRoute>} />

      <Route path="/student/dashboard" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/test/:id" element={<ProtectedRoute allowedRole="student"><TestInterface /></ProtectedRoute>} />
      <Route path="/student/result/:id" element={<ProtectedRoute allowedRole="student"><ResultPage /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
