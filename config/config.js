require('dotenv').config();

// Подключение к PostgreSQL (в нём хранятся только пользователи).
// Подключение к MongoDB (посты) настраивается через MONGO_URI в db.js.
const pg = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  dialect: process.env.DB_DIALECT || 'postgres',
};

module.exports = {
  development: { ...pg },
  test: { ...pg },
  production: { ...pg },
};
