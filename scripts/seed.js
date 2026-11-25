require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const Post = require('../models/post');

const DEMO_POSTS = [
  {
    title: 'Пробки на границе с Польшей',
    content: 'Делюсь опытом прохождения границы в Бресте, очередь заняла 8 часов.',
    author: 'Сергей_Даф',
    category: 'Границы',
    tags: ['граница', 'польша', 'важный'],
    comments: [
      { author: 'Игорь_Вольво', text: 'Спасибо, учту при планировании рейса', likes: 2 },
      { author: 'Макс_Скания', text: 'В прошлом месяце было быстрее — около 5 часов' },
    ],
  },
  {
    title: 'Лучшие приложения для поиска стоянок',
    content: 'Пользуюсь несколькими приложениями, вот сравнение по удобству.',
    author: 'Игорь_Вольво',
    category: 'Стоянки',
    tags: ['стоянки', 'приложения'],
    comments: [{ author: 'Сергей_Даф', text: 'Какое из них работает без интернета?' }],
  },
];

async function seed() {
  await connectDB();
  await Post.deleteMany({ title: { $in: DEMO_POSTS.map((p) => p.title) } });
  await Post.insertMany(DEMO_POSTS);
  console.log(`Добавлено демо-постов: ${DEMO_POSTS.length}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
