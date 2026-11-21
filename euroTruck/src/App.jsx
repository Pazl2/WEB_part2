import { useState, useCallback } from 'react';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import PostList from './components/PostList';
import './App.css';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '');
  const [authOpen, setAuthOpen] = useState(false);

  const handleLogin = (newToken, newEmail) => {
    setToken(newToken);
    setEmail(newEmail);
    setAuthOpen(false);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  return (
    <>
      <Header
        token={token}
        email={email}
        onLoginClick={() => setAuthOpen(true)}
        onLogout={handleLogout}
      />
      <main className="container">
        <PostList token={token} email={email} onAuthLost={handleLogout} />
      </main>
      {authOpen && <AuthModal onClose={closeAuth} onLogin={handleLogin} />}
    </>
  );
}
