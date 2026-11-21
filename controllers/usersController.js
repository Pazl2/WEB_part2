const { User } = require('../models');

// DELETE /api/users/:id (только admin) — каскадное удаление:
// pre('deleteOne') в модели User удалит все посты пользователя вместе с их комментариями.
async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: `Пользователь с id=${req.params.id} не найден` });
    }

    await user.deleteOne();
    res.status(200).json({ message: 'Пользователь и его посты удалены', user });
  } catch (err) {
    next(err);
  }
}

module.exports = { deleteUser };
