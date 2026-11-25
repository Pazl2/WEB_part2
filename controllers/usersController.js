const { User, Post, sequelize } = require('../models');

// DELETE /api/users/:id (только admin) — каскадное удаление между двумя базами.
// Внешнего ключа между PostgreSQL и MongoDB нет, поэтому каскад делаем в коде:
// удаляем пользователя в транзакции PostgreSQL, затем в MongoDB:
//   1) его посты (вместе с вложенными комментариями);
//   2) его комментарии в чужих постах;
//   3) его лайки под чужими комментариями (с коррекцией счётчика likes).
// Если любой из шагов упадёт, транзакция PostgreSQL откатится и пользователь останется
// на месте. Операции в MongoDB при этом не откатываются, но все они идемпотентны:
// повторный DELETE доделает остальное.
async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: `Пользователь с id=${id} не найден` });
    }

    let deletedPosts = 0;
    let postsWithCommentsRemoved = 0;
    let postsWithLikesRemoved = 0;
    await sequelize.transaction(async (transaction) => {
      await user.destroy({ transaction });

      const posts = await Post.deleteMany({ userId: id });
      deletedPosts = posts.deletedCount;

      const comments = await Post.updateMany(
        { 'comments.userId': id },
        { $pull: { comments: { userId: id } } }
      );
      postsWithCommentsRemoved = comments.modifiedCount;

      // arrayFilters: затрагиваем только те комментарии, где этот пользователь лайкнул
      const likes = await Post.updateMany(
        { 'comments.likedBy': id },
        { $pull: { 'comments.$[c].likedBy': id }, $inc: { 'comments.$[c].likes': -1 } },
        { arrayFilters: [{ 'c.likedBy': id }] }
      );
      postsWithLikesRemoved = likes.modifiedCount;
    });

    res.status(200).json({
      message: 'Пользователь, его посты, комментарии и лайки удалены',
      user,
      deletedPosts,
      postsWithCommentsRemoved,
      postsWithLikesRemoved,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { deleteUser };
