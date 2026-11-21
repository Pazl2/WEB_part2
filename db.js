const mongoose = require('mongoose');

function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    return Promise.reject(new Error('Переменная MONGO_URI не задана в .env'));
  }

  return mongoose
    .connect(uri)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      throw err;
    });
}

module.exports = connectDB;
