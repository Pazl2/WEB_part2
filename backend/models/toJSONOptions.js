// Общие настройки сериализации: наружу отдаём `id` (строка) вместо `_id`
// и скрываем служебное поле __v, чтобы React-клиент работал как раньше (p.id).
module.exports = {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    delete ret._id;
    return ret;
  },
};
