'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'twoFactorAttempts', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Users', 'twoFactorLockedUntil', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    // Раньше коды лежали открытым текстом, теперь хранится HMAC. Старые коды
    // всё равно не пройдут проверку, поэтому просто аннулируем их.
    await queryInterface.sequelize.query(
      'UPDATE "Users" SET "twoFactorCode" = NULL, "twoFactorExpires" = NULL'
    );
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'twoFactorLockedUntil');
    await queryInterface.removeColumn('Users', 'twoFactorAttempts');
  },
};
