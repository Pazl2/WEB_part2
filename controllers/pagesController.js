// данные хранятся в памяти, без базы данных
const categories = ['Границы', 'Стоянки', 'Маршруты', 'Техника', 'Общее'];

const items = [
  {
    id: 1,
    title: 'Пробки на границе с Польшей',
    content: 'Делюсь опытом прохождения границы в Бресте, очередь заняла 8 часов.',
    author: 'Сергей_Даф',
    category: 'Границы',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
  },
  {
    id: 2,
    title: 'Лучшие приложения для поиска стоянок',
    content: 'Пользуюсь несколькими приложениями, вот сравнение по удобству.',
    author: 'Игорь_Вольво',
    category: 'Стоянки',
    createdAt: new Date('2026-08-10T14:30:00.000Z'),
  },
];

let nextId = items.length + 1;

// главная страница: список тем
function showIndex(req, res) {
  res.render('index', { title: 'Форум дальнобойщиков', items });
}

// детальная страница темы по id
function showItem(req, res, next) {
  const id = Number(req.params.id);
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    return next();
  }

  res.render('item', { title: item.title, item });
}

// форма добавления новой темы
function showAddForm(req, res) {
  res.render('add', {
    title: 'Новая тема',
    user: req.user,
    categories,
    error: null,
    values: {},
  });
}

// добавление темы в массив с валидацией полей
function createItem(req, res) {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const author = String(body.author || '').trim();
  const category = categories.includes(body.category) ? body.category : 'Общее';

  if (!title || !content || !author) {
    return res.status(400).render('add', {
      title: 'Новая тема',
      user: req.user,
      categories,
      error: 'Поля «Заголовок», «Текст» и «Автор» обязательны',
      values: { title, content, author, category },
    });
  }

  items.push({ id: nextId++, title, content, author, category, createdAt: new Date() });
  res.redirect('/');
}

function showLogin(req, res) {
  res.render('login', { title: 'Вход' });
}

// вызывает ошибку для проверки страницы 500
function triggerError(req, res, next) {
  next(new Error('Тестовая ошибка сервера'));
}

module.exports = { showIndex, showItem, showAddForm, createItem, showLogin, triggerError };
