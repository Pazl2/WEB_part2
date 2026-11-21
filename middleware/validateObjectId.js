const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// validateObjectId('id', 'commentId') — проверяет, что параметры маршрута
// являются корректными ObjectId, иначе отвечает 400 (а не падает с CastError).
function validateObjectId(...names) {
  return function (req, res, next) {
    for (const name of names) {
      if (!OBJECT_ID_RE.test(req.params[name])) {
        return res.status(400).json({ error: `Некорректный идентификатор: ${name}` });
      }
    }
    next();
  };
}

module.exports = { validateObjectId };
