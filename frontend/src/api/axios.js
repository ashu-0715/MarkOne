import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eduai_token');
  const isAuthRequest = config.url?.includes('/auth/');
  if (token && !isAuthRequest) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const token = localStorage.getItem('eduai_token');
    const isAuthRequest = err.config?.url?.includes('/auth/');
    if (err.response?.status === 401 && token && !isAuthRequest) {
      localStorage.removeItem('eduai_token');
      localStorage.removeItem('eduai_role');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
