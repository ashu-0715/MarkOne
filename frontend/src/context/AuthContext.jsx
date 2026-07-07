import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('eduai_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [role, setRole] = useState(() => localStorage.getItem('eduai_role') || null);

  const login = (token, userData, userRole) => {
    localStorage.setItem('eduai_token', token);
    localStorage.setItem('eduai_role', userRole);
    localStorage.setItem('eduai_user', JSON.stringify(userData));
    setUser(userData);
    setRole(userRole);
  };

  const logout = () => {
    localStorage.removeItem('eduai_token');
    localStorage.removeItem('eduai_role');
    localStorage.removeItem('eduai_user');
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
