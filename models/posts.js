let posts = [
  {
    id: 1,
    title: 'Пробки на границе с Польшей',
    content: 'Делюсь опытом прохождения границы в Бресте, очередь заняла 8 часов.',
    author: 'Сергей_Даф',
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 2,
    title: 'Лучшие приложения для поиска стоянок',
    content: 'Пользуюсь несколькими приложениями, вот сравнение по удобству.',
    author: 'Игорь_Вольво',
    createdAt: '2026-08-10T14:30:00.000Z',
  },
];

let nextId = 3;

function getAll() {
  return posts;
}

function getById(id) {
  return posts.find((p) => p.id === id);
}

function create({ title, content, author }) {
  const post = {
    id: nextId++,
    title,
    content,
    author,
    createdAt: new Date().toISOString(),
  };
  posts.push(post);
  return post;
}

function update(id, { title, content, author }) {
  const post = getById(id);
  if (!post) return null;
  post.title = title;
  post.content = content;
  post.author = author;
  return post;
}

function remove(id) {
  const index = posts.findIndex((p) => p.id === id);
  if (index === -1) return false;
  posts.splice(index, 1);
  return true;
}

module.exports = { getAll, getById, create, update, remove };
