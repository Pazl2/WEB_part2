import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fetchPosts = (search = '') =>
  api.get('/posts', { params: search ? { search } : {} });
export const addPost = (post) => api.post('/posts', post);
export const updatePost = (id, updated) => api.put(`/posts/${id}`, updated);
export const deletePost = (id) => api.delete(`/posts/${id}`);

export const registerUser = (email, password) =>
  api.post('/auth/register', { email, password });
export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password });
export const verifyCode = (email, code) =>
  api.post('/auth/verify-2fa', { email, code });

export const getErrorMessage = (err) => {
  if (err.response) {
    const serverMessage = err.response.data && err.response.data.error;
    if (err.response.status >= 500) {
      return serverMessage || 'Ошибка сервера (500). Попробуйте позже';
    }
    return serverMessage || `Ошибка запроса (${err.response.status})`;
  }
  if (err.request) {
    return 'Сервер недоступен. Повторите попытку позже';
  }
  return err.message;
};
