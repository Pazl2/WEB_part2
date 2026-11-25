// Единое место для лимитов и допустимых значений. Клиент дублирует часть из них
// (maxLength в формах), но проверяет и принимает решение всегда сервер.

module.exports = {
  CATEGORIES: ['Общее', 'Границы', 'Стоянки', 'Дороги'],
  DEFAULT_CATEGORY: 'Общее',

  TITLE_MAX: 150,
  CONTENT_MAX: 10000,
  TAG_MAX_LENGTH: 30,
  TAGS_MAX_COUNT: 10,

  COMMENT_MAX: 500,
  // Комментарии лежат внутри документа поста, а документ в MongoDB не больше 16 МБ,
  // поэтому их число ограничено
  COMMENTS_MAX_PER_POST: 500,

  SEARCH_MAX: 100,
  PAGE_SIZE_DEFAULT: 10,
  PAGE_SIZE_MAX: 50,
  PAGE_MAX: 100000,

  USERNAME_MIN: 3,
  USERNAME_MAX: 24,
};
