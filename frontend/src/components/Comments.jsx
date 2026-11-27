import { useState } from 'react';
import { addComment, likeComment, unlikeComment, deleteComment } from '../api';

export default function Comments({ post, token, user, disabled, onUpdate, onFailure }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const comments = post.comments || [];

  const run = async (request, errorPrefix) => {
    setBusy(true);
    try {
      const res = await request();
      onUpdate(res.data);
      return true;
    } catch (err) {
      onFailure(err, errorPrefix);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const ok = await run(() => addComment(post.id, value), 'Не удалось добавить комментарий');
    if (ok) setText('');
  };

  // Кнопка «Удалить» только для автора комментария и админа (сервер проверяет то же самое)
  const canDelete = (comment) =>
    Boolean(user) &&
    (user.role === 'admin' || (comment.userId != null && comment.userId === user.id));

  return (
    <div className="comments">
      <button
        type="button"
        className="comments-toggle"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Скрыть комментарии' : 'Комментарии'} ({comments.length})
      </button>

      {open && (
        <div className="comments-body">
          {comments.length === 0 ? (
            <p className="comments-empty">Комментариев пока нет</p>
          ) : (
            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id} className="comment">
                  <div className="comment-head">
                    <strong>{c.author}</strong>
                    <small>{new Date(c.createdAt).toLocaleDateString('ru-RU')}</small>
                  </div>
                  <p className="comment-text">{c.text}</p>
                  <div className="comment-actions">
                    <button
                      type="button"
                      className={c.likedByMe ? 'comment-btn comment-btn-liked' : 'comment-btn'}
                      disabled={!token || busy}
                      title={
                        !token
                          ? 'Войдите, чтобы ставить лайки'
                          : c.likedByMe
                            ? 'Убрать лайк'
                            : 'Нравится'
                      }
                      onClick={() =>
                        c.likedByMe
                          ? run(() => unlikeComment(post.id, c.id), 'Не удалось убрать лайк')
                          : run(() => likeComment(post.id, c.id), 'Не удалось поставить лайк')
                      }
                    >
                      {c.likedByMe ? '♥' : '♡'} {c.likes}
                    </button>
                    {token && canDelete(c) && (
                      <button
                        type="button"
                        className="comment-btn comment-btn-danger"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => deleteComment(post.id, c.id),
                            'Не удалось удалить комментарий'
                          )
                        }
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {token ? (
            <form className="comment-form" onSubmit={handleSubmit}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ваш комментарий"
                maxLength={500}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                Отправить
              </button>
            </form>
          ) : (
            <p className="comments-empty">Войдите, чтобы оставить комментарий</p>
          )}
        </div>
      )}
    </div>
  );
}
