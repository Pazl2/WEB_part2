'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'username', {
      type: Sequelize.STRING(24),
      allowNull: true,
    });
    // Уже зарегистрированным пользователям выдаём имя user<id>. Часть email до @ брать
    // нельзя: это уже часть адреса. Новое имя пока выбрать нельзя (смена имени не реализована).
    await queryInterface.sequelize.query('UPDATE "Users" SET "username" = \'user\' || "id"');
    await queryInterface.changeColumn('Users', 'username', {
      type: Sequelize.STRING(24),
      allowNull: false,
    });
    // Уникальность без учёта регистра: «Ivan» и «ivan» — одно имя
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX "users_username_lower_key" ON "Users" (lower("username"))'
    );
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "users_username_lower_key"');
    await queryInterface.removeColumn('Users', 'username');
  },
};
