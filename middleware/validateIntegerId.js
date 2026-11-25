function validateIntegerId(name) {
  return function (req, res, next) {
    if (!/^[1-9]\d*$/.test(req.params[name])) {
      return res.status(400).json({ error: `Некорректный идентификатор: ${name}` });
    }
    next();
  };
}

module.exports = { validateIntegerId };
