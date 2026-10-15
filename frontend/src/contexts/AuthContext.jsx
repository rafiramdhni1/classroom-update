import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed.user);
        setStudent(parsed.student);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (nis, password) => {
    const { data } = await api.post('/auth/login', { nis, password });

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data.user);
    setStudent(data.student);

    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setStudent(null);
  };

  const updateUser = (updatedFields) => {
    setUser(prev => {
      const nextUser = { ...prev, ...updatedFields };
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          parsed.user = { ...parsed.user, ...updatedFields };
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      } catch {}
      return nextUser;
    });
  };

  return (
    <AuthContext.Provider value={{ user, student, login, logout, updateUser, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
