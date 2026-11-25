import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchPosts, addPost, updatePost, deletePost, getErrorMessage } from '../api';
import useDebounce from '../hooks/useDebounce';
import Spinner from './Spinner';
import Notification from './Notification';
import Select from './Select';
import Comments from './Comments';

const CATEGORIES = ['Общее', 'Границы', 'Стоянки', 'Дороги'];
const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c }));
const FILTER_OPTIONS = [{ value: 'Все', label: 'Все категории' }, ...CATEGORY_OPTIONS];
const SORT_OPTIONS = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'old', label: 'Сначала старые' },
];
const EMPTY_FORM = { title: '', content: '', category: 'Общее', tags: '' };
const PAGE_SIZE = 10;
const EMPTY_META = { total: 0, totalPages: 1, categoryCounts: {} };

const parseTags = (value) => [
  ...new Set(
    value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  ),
];

export default function PostList({ token, user, socket, onAuthLost }) {
  const [posts, setPosts] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(0);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('Все');
  const [sort, setSort] = useState('new');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [pageState, setPageState] = useState({ key: '', page: 1 });

  const debouncedSearch = useDebounce(search, 500);
  const requestId = useRef(0);

  // Поиск, тег, категория и сортировка выполняются на сервере. Номер страницы привязан
  // к набору этих параметров: при смене любого из них страница сама становится первой,
  // и лишнего запроса со старым номером страницы не будет.
  const filtersKey = JSON.stringify([debouncedSearch, tag, filter, sort]);
  const page = pageState.key === filtersKey ? pageState.page : 1;
  const goToPage = (next) => setPageState({ key: filtersKey, page: next });

  const query = useMemo(
    () => ({
      search: debouncedSearch,
      tag,
      category: filter === 'Все' ? '' : filter,
      sort,
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, tag, filter, sort, page]
  );

  // silent: обновить данные без спиннера (после создания, правки и удаления поста)
  const reload = useCallback(async (params, { silent = false } = {}) => {
    const id = ++requestId.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetchPosts(params);
      if (id !== requestId.current) return;
      const { items, total, totalPages, categoryCounts } = res.data;
      setPosts(items);
      setMeta({ total, totalPages, categoryCounts });
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent && id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload(query);
  }, [query, reload]);

  // Актуальные значения для обработчиков сокета (чтобы не переподписываться при каждом вводе)
  const queryRef = useRef(query);
  const editingIdRef = useRef(editingId);
  useEffect(() => {
    queryRef.current = query;
    editingIdRef.current = editingId;
  });

  // Уведомления в реальном времени (WebSocket). Комментарии и лайки применяются к ленте
  // «точечно» (изменения идемпотентны: повторное событие ничего не ломает), а при
  // изменении постов лента тихо перечитывается с сервера с текущими фильтрами и страницей.
  useEffect(() => {
    if (!socket) return undefined;
    let timer = null;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reload(queryRef.current, { silent: true }), 300);
    };
    const info = (e, text) => {
      if (!user || e.actorId !== user.id) setNotice({ type: 'info', text });
    };
    const patchPost = (postId, change) =>
      setPosts((prev) => prev.map((p) => (p.id === postId ? change(p) : p)));

    const handlers = {
      'post:created': (e) => {
        info(e, `Новый пост от ${e.author}: «${e.title}»`);
        refresh();
      },
      'post:updated': (e) => {
        info(e, `Пост «${e.title}» изменён`);
        refresh();
      },
      'post:deleted': (e) => {
        if (editingIdRef.current === e.id) {
          setForm(EMPTY_FORM);
          setEditingId(null);
        }
        info(e, `Пост «${e.title}» удалён`);
        refresh();
      },
      'comment:added': (e) => {
        patchPost(e.postId, (p) => {
          const comments = p.comments || [];
          return comments.some((c) => c.id === e.comment.id) ? p : { ...p, comments: [...comments, e.comment] };
        });
        info(e, `${e.comment.author} прокомментировал пост «${e.postTitle}»`);
      },
      'comment:deleted': (e) =>
        patchPost(e.postId, (p) => ({ ...p, comments: (p.comments || []).filter((c) => c.id !== e.commentId) })),
      'comment:liked': (e) =>
        patchPost(e.postId, (p) => ({
          ...p,
          comments: (p.comments || []).map((c) => (c.id === e.commentId ? { ...c, likes: e.likes } : c)),
        })),
      'content:refresh': refresh,
    };

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    return () => {
      clearTimeout(timer);
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
    };
  }, [socket, user, reload]);

  useEffect(() => {
    document.title = `Посты: ${meta.total}`;
  }, [meta.total]);

  const closeNotice = useCallback(() => setNotice(null), []);

  const notify = (text, type = 'error') => setNotice({ text, type });

  const track = async (request) => {
    setSyncing((c) => c + 1);
    try {
      return await request();
    } finally {
      setSyncing((c) => c - 1);
    }
  };

  const handleFailure = (err, prefix) => {
    // 401 — токен недействителен, выходим из аккаунта.
    // 403 — «нет прав на это действие»: сессия при этом в порядке, только сообщаем об ошибке.
    const status = err.response && err.response.status;
    if (status === 401) onAuthLost();
    notify(`${prefix}: ${getErrorMessage(err)}`);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const createPost = async (data) => {
    const tempId = Date.now();
    const optimistic = {
      id: tempId,
      ...data,
      author: user ? user.username : '',
      userId: user ? user.id : null,
      comments: [],
      createdAt: new Date().toISOString(),
      pending: true,
    };
    // Новый пост попадает в начало первой страницы; на остальных страницах его
    // просто не видно, его покажет синхронизация после ответа сервера.
    const showOptimistic = page === 1 && sort === 'new';
    if (showOptimistic) setPosts((prev) => [optimistic, ...prev]);
    resetForm();

    try {
      const res = await track(() => addPost(data));
      if (showOptimistic) {
        setPosts((prev) => prev.map((p) => (p.id === tempId ? res.data : p)));
      }
      reload(query, { silent: true });
    } catch (err) {
      if (showOptimistic) setPosts((prev) => prev.filter((p) => p.id !== tempId));
      handleFailure(err, 'Не удалось добавить пост');
    }
  };

  const editPost = async (id, data) => {
    const previous = posts.find((p) => p.id === id);
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    resetForm();

    try {
      const res = await track(() => updatePost(id, data));
      setPosts((prev) => prev.map((p) => (p.id === id ? res.data : p)));
      // категория могла измениться, и пост выпал из текущего фильтра
      reload(query, { silent: true });
    } catch (err) {
      setPosts((prev) => prev.map((p) => (p.id === id ? previous : p)));
      handleFailure(err, 'Не удалось сохранить изменения');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      tags: parseTags(form.tags),
    };
    if (!data.title || !data.content) return;

    if (editingId !== null) {
      editPost(editingId, data);
    } else {
      createPost(data);
    }
  };

  const startEdit = (post) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      content: post.content,
      category: post.category,
      tags: (post.tags || []).join(', '),
    });
  };

  const updatePostInList = (updated) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const removePost = async (id) => {
    const index = posts.findIndex((p) => p.id === id);
    const removed = posts[index];
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) resetForm();

    try {
      await track(() => deletePost(id));
      if (posts.length === 1 && page > 1) {
        goToPage(page - 1); // удалили последний пост страницы — переходим на предыдущую
      } else {
        reload(query, { silent: true });
      }
    } catch (err) {
      setPosts((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
      handleFailure(err, 'Не удалось удалить пост');
    }
  };

  // Редактировать и удалять может автор поста или админ (сервер проверяет то же самое)
  const canModify = (post) =>
    Boolean(user) &&
    (user.role === 'admin' || (post.userId != null && post.userId === user.id));

  // Счётчики приходят с сервера: на клиенте загружена только одна страница
  const countByCategory = CATEGORIES.map((c) => ({
    name: c,
    count: meta.categoryCounts[c] || 0,
  }));
  const allCount = countByCategory.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="page">
      <Notification notice={notice} onClose={closeNotice} />

      <section className="intro">
        <h1>Лента постов</h1>
        <p>Делитесь опытом с коллегами: границы, стоянки, дороги.</p>
      </section>

      {token && (
        <form className="card form" onSubmit={handleSubmit}>
          <h2>{editingId !== null ? 'Редактирование поста' : 'Новый пост'}</h2>
          <div className="form-row">
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Заголовок"
            />
            <Select
              label="Категория поста"
              value={form.category}
              options={CATEGORY_OPTIONS}
              onChange={(category) => setForm((prev) => ({ ...prev, category }))}
            />
          </div>
          <textarea
            name="content"
            value={form.content}
            onChange={handleChange}
            placeholder="Текст поста"
            rows={3}
          />
          <input
            name="tags"
            value={form.tags}
            onChange={handleChange}
            placeholder="Теги через запятую (например: граница, важный)"
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId !== null ? 'Сохранить' : 'Добавить'}
            </button>
            {editingId !== null && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Отмена
              </button>
            )}
            {syncing > 0 && (
              <span className="syncing">
                <span className="spinner spinner-small" />
                Синхронизация с сервером...
              </span>
            )}
          </div>
        </form>
      )}

      <div className="toolbar">
        <input
          type="search"
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по постам"
        />
        <Select
          label="Категория"
          value={filter}
          options={FILTER_OPTIONS}
          onChange={setFilter}
        />
        <Select label="Сортировка" value={sort} options={SORT_OPTIONS} onChange={setSort} />
      </div>

      {tag && (
        <div className="stats">
          <span className="chip chip-tag">
            Тег: #{tag}
            <button
              type="button"
              className="chip-close"
              aria-label="Сбросить фильтр по тегу"
              onClick={() => setTag('')}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="error-box">
          <p>{error}</p>
          <button type="button" className="btn btn-danger" onClick={() => reload(query)}>
            Повторить
          </button>
        </div>
      ) : (
        <>
          <div className="stats">
            <span className="chip chip-strong">Всего: {allCount}</span>
            <span className="chip chip-strong">Найдено: {meta.total}</span>
            {countByCategory.map((c) => (
              <span key={c.name} className="chip">
                {c.name}: {c.count}
              </span>
            ))}
          </div>

          {posts.length === 0 ? (
            <p className="empty">Постов нет</p>
          ) : (
            <ul className="list">
              {posts.map((p) => (
                <li key={p.id} className={p.pending ? 'card post post-pending' : 'card post'}>
                  <div className="post-head">
                    <h3>{p.title}</h3>
                    <span className="badge">{p.category}</span>
                  </div>
                  <p className="post-text">{p.content}</p>
                  {p.tags && p.tags.length > 0 && (
                    <div className="tags">
                      {p.tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={t === tag ? 'tag tag-active' : 'tag'}
                          onClick={() => setTag(t === tag ? '' : t)}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="post-foot">
                    <small>
                      {p.author} · {new Date(p.createdAt).toLocaleDateString('ru-RU')}
                      {p.pending && ' · сохраняется...'}
                    </small>
                    {token && canModify(p) && (
                      <div className="post-buttons">
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={p.pending}
                          onClick={() => startEdit(p)}
                        >
                          Редактировать
                        </button>
                        <button
                          className="btn btn-danger-outline btn-sm"
                          disabled={p.pending}
                          onClick={() => removePost(p.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                  <Comments
                    post={p}
                    token={token}
                    user={user}
                    disabled={Boolean(p.pending)}
                    onUpdate={updatePostInList}
                    onFailure={handleFailure}
                  />
                </li>
              ))}
            </ul>
          )}

          {meta.totalPages > 1 && (
            <div className="pager">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                ← Назад
              </button>
              <span className="pager-info">
                Страница {page} из {meta.totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= meta.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Вперёд →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
