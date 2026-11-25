const INT32_MAX = 2147483647; // INTEGER в PostgreSQL; больше — ошибка БД (500) вместо 400

function validateIntegerId(name) {
  return function (req, res, next) {
    const value = req.params[name];
    if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > INT32_MAX) {
      return res.status(400).json({ error: `Некорректный идентификатор: ${name}` });
    }
    next();
  };
}

module.exports = { validateIntegerId };
