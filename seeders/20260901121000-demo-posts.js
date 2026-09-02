'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Posts', [
      {
        title: 'Пробки на границе с Польшей',
        content: 'Делюсь опытом прохождения границы в Бресте, очередь заняла 8 часов.',
        author: 'Сергей_Даф',
        category: 'Границы',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        title: 'Лучшие приложения для поиска стоянок',
        content: 'Пользуюсь несколькими приложениями, вот сравнение по удобству.',
        author: 'Игорь_Вольво',
        category: 'Стоянки',
        createdAt: new Date('2026-08-10T14:30:00.000Z'),
        updatedAt: new Date('2026-08-10T14:30:00.000Z'),
      },
    ]);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Posts', null, {});
  },
};
