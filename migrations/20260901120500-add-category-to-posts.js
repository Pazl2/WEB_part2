'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Posts', 'category', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Общее',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Posts', 'category');
  },
};
