// единые ограничения длины полей темы (используются и в формах, и в API, и в модели)
const LIMITS = {
  title: 50,
  author: 50,
  content: 300,
};

const LABELS = {
  title: 'Заголовок',
  author: 'Автор',
  content: 'Текст',
};

// проверяет title, content, author; возвращает строку с ошибкой или null
function validatePostFields({ title, content, author }) {
  const values = { title, content, author };

  for (const field of Object.keys(LIMITS)) {
    if (typeof values[field] !== 'string' || !values[field].trim()) {
      return 'Поля «Заголовок», «Текст» и «Автор» обязательны';
    }
  }

  for (const field of Object.keys(LIMITS)) {
    if (values[field].trim().length > LIMITS[field]) {
      return `Поле «${LABELS[field]}» не должно быть длиннее ${LIMITS[field]} символов`;
    }
  }

  return null;
}

module.exports = { LIMITS, LABELS, validatePostFields };
