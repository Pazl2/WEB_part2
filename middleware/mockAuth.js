// имитация авторизации: пропускает только запросы с ?auth=1
function mockAuth(req, res, next) {
  if (req.query.auth === '1') {
    req.user = { name: 'Дальнобойщик' };
    return next();
  }
  res.redirect('/login');
}

module.exports = { mockAuth };
