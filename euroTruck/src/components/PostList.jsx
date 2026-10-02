import { useState, useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

const CATEGORIES = ['Общее', 'Границы', 'Стоянки', 'Дороги'];

const INITIAL_POSTS = [
  {
    id: 1,
    title: 'Пробки на границе с Польшей',
    content: 'Делюсь опытом прохождения границы в Бресте, очередь заняла 8 часов.',
    author: 'Сергей_Даф',
    category: 'Границы',
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 2,
    title: 'Лучшие приложения для поиска стоянок',
    content: 'Пользуюсь несколькими приложениями, вот сравнение по удобству.',
    author: 'Игорь_Вольво',
    category: 'Стоянки',
    createdAt: '2026-08-10T14:30:00.000Z',
  },
];

const EMPTY_FORM = { title: '', content: '', author: '', category: 'Общее' };

export default function PostList() {
  const [posts, setPosts, loaded] = useLocalStorage('posts', INITIAL_POSTS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('Все');
  const [sort, setSort] = useState('new');

  useEffect(() => {
    document.title = `Посты: ${posts.length}`;
  }, [posts.length]);

  if (!loaded) {
    return <p className="loading">Загрузка...</p>;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();
    const author = form.author.trim();
    if (!title || !content || !author) {
      return;
    }

    if (editingId !== null) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === editingId ? { ...p, title, content, author, category: form.category } : p
        )
      );
    } else {
      const newPost = {
        id: Date.now(),
        title,
        content,
        author,
        category: form.category,
        createdAt: new Date().toISOString(),
      };
      setPosts((prev) => [newPost, ...prev]);
    }
    resetForm();
  };

  const startEdit = (post) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      content: post.content,
      author: post.author,
      category: post.category,
    });
  };

  const removePost = (id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) {
      resetForm();
    }
  };

  const visiblePosts = posts
    .filter((p) => filter === 'Все' || p.category === filter)
    .sort((a, b) =>
      sort === 'new'
        ? new Date(b.createdAt) - new Date(a.createdAt)
        : new Date(a.createdAt) - new Date(b.createdAt)
    );

  const countByCategory = CATEGORIES.map((c) => ({
    name: c,
    count: posts.filter((p) => p.category === c).length,
  }));

  return (
    <div className="container">
      <h1>Форум дальнобойщиков</h1>

      <form className="form" onSubmit={handleSubmit}>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Заголовок"
        />
        <input
          name="author"
          value={form.author}
          onChange={handleChange}
          placeholder="Автор"
        />
        <select name="category" value={form.category} onChange={handleChange}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <textarea
          name="content"
          value={form.content}
          onChange={handleChange}
          placeholder="Текст поста"
          rows={3}
        />
        <div className="form-buttons">
          <button type="submit">{editingId !== null ? 'Сохранить' : 'Добавить'}</button>
          {editingId !== null && (
            <button type="button" onClick={resetForm}>
              Отмена
            </button>
          )}
        </div>
      </form>

      <div className="controls">
        <label>
          Категория:{' '}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="Все">Все</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Сортировка:{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">Сначала новые</option>
            <option value="old">Сначала старые</option>
          </select>
        </label>
      </div>

      <div className="stats">
        <span>Всего: {posts.length}</span>
        <span>Показано: {visiblePosts.length}</span>
        {countByCategory.map((c) => (
          <span key={c.name}>
            {c.name}: {c.count}
          </span>
        ))}
      </div>

      {visiblePosts.length === 0 ? (
        <p>Постов нет</p>
      ) : (
        <ul className="list">
          {visiblePosts.map((p) => (
            <li key={p.id} className="post">
              <div className="post-head">
                <strong>{p.title}</strong>
                <span className="badge">{p.category}</span>
              </div>
              <p>{p.content}</p>
              <small>
                {p.author} · {new Date(p.createdAt).toLocaleDateString('ru-RU')}
              </small>
              <div className="post-buttons">
                <button onClick={() => startEdit(p)}>Редактировать</button>
                <button onClick={() => removePost(p.id)}>Удалить</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}