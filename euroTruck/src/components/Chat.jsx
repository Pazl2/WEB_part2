import { useEffect, useRef, useState } from 'react';
import useChat, { ROOMS, roomKey, pmKey } from '../hooks/useChat';

const STATUS_TEXT = {
  online: 'В сети',
  connecting: 'Подключение…',
  reconnecting: 'Переподключение…',
  offline: 'Нет связи',
};

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

function typingText(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} печатает…`;
  return `${names.slice(0, 2).join(', ')} печатают…`;
}

// Плавающее окно чата: комнаты (по категориям), личные диалоги, список онлайн
export default function Chat({ socket, status, user }) {
  const chat = useChat(socket, user);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const listRef = useRef(null);

  const connected = status === 'online';
  const messages = chat.conversations[chat.active] || [];
  const isPrivate = chat.active.startsWith('pm:');
  const typingNames = Object.values(chat.typing[chat.active] || {});
  const totalUnread = Object.values(chat.unread).reduce((sum, n) => sum + n, 0);
  const onlineIds = new Set(chat.online.map((u) => u.id));

  const activeDialog = isPrivate ? chat.dialogs.find((d) => pmKey(d.id) === chat.active) : null;
  const title = isPrivate ? `Личный диалог: ${activeDialog ? activeDialog.username : ''}` : `Комната «${chat.room}»`;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, chat.active, chat.open]);

  const handleChange = (e) => {
    setText(e.target.value);
    setError('');
    if (e.target.value.trim()) chat.notifyTyping();
    else chat.stopTyping();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy || !connected) return;
    setBusy(true);
    setError('');
    setNote('');
    const res = await chat.send(value);
    setBusy(false);
    if (res.ok) {
      setText('');
      if (res.delivered === false) setNote('Получатель не в сети: он увидит сообщение в истории диалога');
    } else {
      setError(res.error);
    }
  };

  const handleRoom = async (room) => {
    setError('');
    const res = await chat.selectRoom(room);
    if (!res.ok) setError(res.error);
  };

  const handleOpenDialog = (id, username) => {
    setShowOnline(false);
    setNote('');
    chat.openDialog(id, username);
  };

  if (!chat.open) {
    return (
      <button type="button" className="chat-toggle" onClick={() => chat.setOpen(true)}>
        Чат
        <span className={`chat-dot chat-dot-${status}`} aria-hidden="true" />
        {totalUnread > 0 && <span className="chat-badge">{totalUnread}</span>}
      </button>
    );
  }

  return (
    <section className="chat-panel" aria-label="Чат">
      <header className="chat-head">
        <div>
          <strong>Чат</strong>
          <span className="chat-status">
            <span className={`chat-dot chat-dot-${status}`} aria-hidden="true" />
            {STATUS_TEXT[status]}
          </span>
        </div>
        <div className="chat-head-actions">
          <button type="button" className="chat-link" onClick={() => setShowOnline((v) => !v)}>
            Онлайн: {chat.online.length}
          </button>
          <button type="button" className="icon-btn" aria-label="Свернуть чат" onClick={() => chat.setOpen(false)}>
            ×
          </button>
        </div>
      </header>

      <nav className="chat-tabs" aria-label="Комнаты и диалоги">
        {ROOMS.map((room) => (
          <button
            key={room}
            type="button"
            className={chat.active === roomKey(room) ? 'chat-tab chat-tab-active' : 'chat-tab'}
            disabled={!connected}
            onClick={() => handleRoom(room)}
          >
            # {room}
            {chat.unread[roomKey(room)] > 0 && <span className="chat-badge">{chat.unread[roomKey(room)]}</span>}
          </button>
        ))}
        {chat.dialogs.map((d) => (
          <button
            key={d.id}
            type="button"
            className={chat.active === pmKey(d.id) ? 'chat-tab chat-tab-active' : 'chat-tab'}
            onClick={() => handleOpenDialog(d.id, d.username)}
          >
            @ {d.username}
            {onlineIds.has(d.id) && <span className="chat-dot chat-dot-online" aria-label="в сети" />}
            {chat.unread[pmKey(d.id)] > 0 && <span className="chat-badge">{chat.unread[pmKey(d.id)]}</span>}
          </button>
        ))}
      </nav>

      {showOnline && (
        <div className="chat-online">
          <small>Нажмите на имя, чтобы написать лично</small>
          <ul>
            {chat.online.map((u) => (
              <li key={u.id}>
                {u.id === user.id ? (
                  <span>{u.username} (вы)</span>
                ) : (
                  <button type="button" className="chat-link" onClick={() => handleOpenDialog(u.id, u.username)}>
                    {u.username}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="chat-subhead">
        <strong>{title}</strong>
        {!isPrivate && chat.members.length > 0 && (
          <small>В комнате: {chat.members.map((m) => m.username).join(', ')}</small>
        )}
      </div>

      <ul className="chat-messages" ref={listRef}>
        {messages.length === 0 && <li className="chat-empty">Сообщений пока нет</li>}
        {messages.map((m) =>
          m.system ? (
            <li key={m.id} className="chat-msg chat-msg-system">
              {m.text}
            </li>
          ) : (
            <li key={m.id} className={m.userId === user.id ? 'chat-msg chat-msg-own' : 'chat-msg'}>
              <div className="chat-msg-head">
                <strong>{m.author}</strong>
                <small>{formatTime(m.createdAt)}</small>
              </div>
              <p>{m.text}</p>
            </li>
          )
        )}
      </ul>

      <div className="chat-typing" aria-live="polite">
        {typingText(typingNames)}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={handleChange}
          placeholder={connected ? 'Сообщение…' : 'Нет соединения'}
          maxLength={500}
          disabled={!connected}
          aria-label="Текст сообщения"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !connected || !text.trim()}>
          Отправить
        </button>
      </form>
      {error && <p className="chat-error">{error}</p>}
      {note && !error && <p className="chat-note">{note}</p>}
    </section>
  );
}
