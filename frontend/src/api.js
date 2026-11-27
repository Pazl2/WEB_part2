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

// Ответ: { items, total, page, limit, totalPages, categoryCounts }
export const fetchPosts = ({ search = '', tag = '', category = '', sort = 'new', page = 1, limit } = {}) =>
  api.get('/posts', {
    params: {
      ...(search ? { search } : {}),
      ...(tag ? { tag } : {}),
      ...(category ? { category } : {}),
      sort,
      page,
      ...(limit ? { limit } : {}),
    },
  });
export const addPost = (post) => api.post('/posts', post);
export const updatePost = (id, updated) => api.put(`/posts/${id}`, updated);
export const deletePost = (id) => api.delete(`/posts/${id}`);

export const addComment = (postId, text) =>
  api.post(`/posts/${postId}/comments`, { text });
export const likeComment = (postId, commentId) =>
  api.put(`/posts/${postId}/comments/${commentId}/like`);
export const unlikeComment = (postId, commentId) =>
  api.delete(`/posts/${postId}/comments/${commentId}/like`);
export const deleteComment = (postId, commentId) =>
  api.delete(`/posts/${postId}/comments/${commentId}`);

export const registerUser = (email, username, password) =>
  api.post('/auth/register', { email, username, password });
export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password });
export const verifyCode = (email, code) =>
  api.post('/auth/verify-2fa', { email, code });
export const getMe = () => api.get('/auth/me');

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
