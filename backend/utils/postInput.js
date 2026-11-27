const L = require('../config/limits');

// Разбор и проверка тела запроса для постов и комментариев.
// Возвращают { value } или { error } (текст для ответа 400). Ничего не обрезают молча:
// слишком длинные данные отклоняются, чтобы пользователь знал, что не сохранилось.

// tags может прийти массивом или строкой "важный, границы"
function parseTags(tags) {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : null;
  if (!list || list.some((t) => typeof t !== 'string')) {
    return { error: 'Поле tags должно быть массивом строк или строкой через запятую' };
  }
  const unique = [...new Set(list.map((t) => t.trim()).filter(Boolean))];
  if (unique.length > L.TAGS_MAX_COUNT) {
    return { error: `Слишком много тегов: максимум ${L.TAGS_MAX_COUNT}` };
  }
  if (unique.some((t) => t.length > L.TAG_MAX_LENGTH)) {
    return { error: `Тег слишком длинный: максимум ${L.TAG_MAX_LENGTH} символов` };
  }
  return { value: unique };
}

// category и tags необязательны: undefined означает «не менять / значение по умолчанию»
function parsePostInput(body) {
  const { title, content, category, tags } = body || {};

  if (typeof title !== 'string' || typeof content !== 'string' || !title.trim() || !content.trim()) {
    return { error: 'Поля title и content обязательны' };
  }
  const cleanTitle = title.trim();
  const cleanContent = content.trim();
  if (cleanTitle.length > L.TITLE_MAX) {
    return { error: `Заголовок слишком длинный: максимум ${L.TITLE_MAX} символов` };
  }
  if (cleanContent.length > L.CONTENT_MAX) {
    return { error: `Текст слишком длинный: максимум ${L.CONTENT_MAX} символов` };
  }

  if (category !== undefined && !L.CATEGORIES.includes(category)) {
    return { error: `Категория должна быть одной из: ${L.CATEGORIES.join(', ')}` };
  }

  let cleanTags;
  if (tags !== undefined) {
    const parsed = parseTags(tags);
    if (parsed.error) return parsed;
    cleanTags = parsed.value;
  }

  return { value: { title: cleanTitle, content: cleanContent, category, tags: cleanTags } };
}

function parseCommentText(body) {
  const text = body && typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return { error: 'Поле text обязательно' };
  if (text.length > L.COMMENT_MAX) {
    return { error: `Комментарий слишком длинный: максимум ${L.COMMENT_MAX} символов` };
  }
  return { value: text };
}

module.exports = { parsePostInput, parseCommentText };
