const { User } = require('../models');

// Превращает документы Post в JSON для клиента:
//  - у каждого комментария добавляет likedByMe (лайкал ли его текущий пользователь);
//    сам список likedBy наружу не отдаётся;
//  - добавляет user: { id, email } автора поста из PostgreSQL (аналог populate между базами).
async function serializePosts(posts, viewer) {
  const viewerId = viewer ? viewer.id : null;

  const ids = [...new Set(posts.map((p) => p.userId).filter((id) => id != null))];
  const users = ids.length
    ? await User.findAll({ where: { id: ids }, attributes: ['id', 'email'] })
    : [];
  const byId = new Map(users.map((u) => [u.id, { id: u.id, email: u.email }]));

  return posts.map((post) => {
    const json = post.toJSON();
    json.comments = post.comments.map((comment, i) => {
      const out = { ...json.comments[i] };
      // список лайкнувших — служебные данные, клиенту он не нужен
      delete out.likedBy;
      delete out._id;
      out.likedByMe = viewerId != null && (comment.likedBy || []).includes(viewerId);
      return out;
    });
    json.user = byId.get(post.userId) || null;
    return json;
  });
}

async function serializePost(post, viewer) {
  const [json] = await serializePosts([post], viewer);
  return json;
}

module.exports = { serializePosts, serializePost };
