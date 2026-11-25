import { useState, useEffect } from 'react';
import { registerUser, loginUser, verifyCode, getErrorMessage } from '../api';

const TITLES = { login: 'Вход', register: 'Регистрация', code: 'Подтверждение входа' };
const BUTTONS = { login: 'Получить код', register: 'Зарегистрироваться', code: 'Подтвердить' };

export default function AuthModal({ onClose, onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const cleanEmail = email.trim();
      if (mode === 'register') {
        await registerUser(cleanEmail, password);
        setMode('login');
        setMessage('Регистрация выполнена. Теперь войдите');
      } else if (mode === 'login') {
        await loginUser(cleanEmail, password);
        setMode('code');
        setMessage('Код подтверждения выведен в консоль сервера');
      } else {
        const res = await verifyCode(cleanEmail, code.trim());
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('email', user.email);
        onLogin(token, user);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="modal-head">
          <h2 id="auth-title">{TITLES[mode]}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mode === 'code'}
              required
              autoFocus
            />
          </label>

          {mode !== 'code' && (
            <label className="field">
              <span>Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          )}

          {mode === 'code' && (
            <label className="field">
              <span>Код из консоли сервера</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                required
                autoFocus
              />
            </label>
          )}

          {message && <p className="form-message">{message}</p>}
          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Подождите...' : BUTTONS[mode]}
          </button>

          <div className="modal-links">
            {mode === 'login' && (
              <button type="button" className="link-btn" onClick={() => switchMode('register')}>
                Нет аккаунта? Регистрация
              </button>
            )}
            {mode !== 'login' && (
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                Вернуться ко входу
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
