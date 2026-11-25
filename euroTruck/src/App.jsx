import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import PostList from './components/PostList';
import { getMe } from './api';
import './App.css';

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  // user = { id, email, role }. Роль нужна только для отображения кнопок:
  // реальные права проверяет сервер.
  const [user, setUser] = useState(() => (localStorage.getItem('token') ? readStoredUser() : null));
  const [authOpen, setAuthOpen] = useState(false);

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    setAuthOpen(false);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  // При загрузке сверяем сохранённую сессию с сервером: подтягиваем актуальную роль
  // и выходим, если токен просрочен или пользователя удалили.
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    getMe()
      .then((res) => {
        const fresh = { id: res.data.id, email: res.data.email, role: res.data.role };
        localStorage.setItem('user', JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch((err) => {
        if (err.response && err.response.status === 401) handleLogout();
      });
  }, [handleLogout]);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  return (
    <>
      <Header
        token={token}
        user={user}
        onLoginClick={() => setAuthOpen(true)}
        onLogout={handleLogout}
      />
      <main className="container">
        <PostList token={token} user={user} onAuthLost={handleLogout} />
      </main>
      {authOpen && <AuthModal onClose={closeAuth} onLogin={handleLogin} />}
    </>
  );
}
