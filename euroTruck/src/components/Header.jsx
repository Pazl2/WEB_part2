export default function Header({ token, user, onLoginClick, onLogout }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 48 32" aria-hidden="true">
            <rect x="1" y="4" width="28" height="18" rx="2" fill="currentColor" />
            <path d="M31 10h9l7 8v6H31z" fill="currentColor" />
            <circle cx="11" cy="26" r="4.5" fill="#1b1f2a" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="38" cy="26" r="4.5" fill="#1b1f2a" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          <div className="brand-text">
            <span className="brand-name">EuroTruck</span>
            <span className="brand-sub">Опыт дальнобойщиков</span>
          </div>
        </div>
        <div className="header-user">
          {token ? (
            <>
              <span className="user-email">{user ? user.username || '' : ''}</span>
              {user && user.role === 'admin' && <span className="user-role">админ</span>}
              <button type="button" className="btn btn-outline-light" onClick={onLogout}>
                Выйти
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onLoginClick}>
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
