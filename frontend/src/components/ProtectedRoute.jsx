import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ProtectedRoute = ({ allowedRole, children }) => {
  const { role } = useAuth();
  if (!role || role !== allowedRole) return <Navigate to="/" replace />;
  return children;
};

export default ProtectedRoute;
