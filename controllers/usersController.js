const { User, Post, sequelize } = require('../models');

// DELETE /api/users/:id (только admin) — каскадное удаление между двумя базами.
// Внешнего ключа между PostgreSQL и MongoDB нет, поэтому каскад делаем в коде:
// удаляем пользователя в транзакции PostgreSQL, затем его посты в MongoDB
// (вместе с вложенными комментариями). Если удаление постов упадёт,
// транзакция откатится и пользователь останется на месте.
async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: `Пользователь с id=${id} не найден` });
    }

    let deletedPosts = 0;
    await sequelize.transaction(async (transaction) => {
      await user.destroy({ transaction });
      const result = await Post.deleteMany({ userId: id });
      deletedPosts = result.deletedCount;
    });

    res.status(200).json({ message: 'Пользователь и его посты удалены', user, deletedPosts });
  } catch (err) {
    next(err);
  }
}

module.exports = { deleteUser };
