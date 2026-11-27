import { useState } from 'react';
import { registerUser, loginUser, verifyCode, getErrorMessage } from '../api';

export default function AuthPanel({ token, onLogin, onLogout }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (token) {
    return (
      <div className="auth auth-row">
        <span>Вы вошли как {email}</span>
        <button type="button" onClick={onLogout}>
          Выйти
        </button>
      </div>
    );
  }

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
      if (mode === 'register') {
        await registerUser(email.trim(), password);
        setMode('login');
        setMessage('Регистрация выполнена. Теперь войдите');
      } else if (mode === 'login') {
        await loginUser(email.trim(), password);
        setMode('code');
        setMessage('Код подтверждения выведен в консоль сервера');
      } else {
        const res = await verifyCode(email.trim(), code.trim());
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('email', email.trim());
        setPassword('');
        setCode('');
        onLogin(res.data.token);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const titles = { login: 'Вход', register: 'Регистрация', code: 'Подтверждение входа' };
  const buttons = { login: 'Получить код', register: 'Зарегистрироваться', code: 'Подтвердить' };

  return (
    <form className="auth form" onSubmit={handleSubmit}>
      <strong>{titles[mode]}</strong>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        disabled={mode === 'code'}
        required
      />
      {mode !== 'code' && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          required
        />
      )}
      {mode === 'code' && (
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Код из консоли сервера"
          required
        />
      )}
      {message && <small className="auth-message">{message}</small>}
      {error && <small className="auth-error">{error}</small>}
      <div className="form-buttons">
        <button type="submit" disabled={busy}>
          {busy ? 'Подождите...' : buttons[mode]}
        </button>
        {mode === 'login' && (
          <button type="button" onClick={() => switchMode('register')}>
            Регистрация
          </button>
        )}
        {mode !== 'login' && (
          <button type="button" onClick={() => switchMode('login')}>
            Ко входу
          </button>
        )}
      </div>
    </form>
  );
}
