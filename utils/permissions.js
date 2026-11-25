// Единое место, где решается «кто что может». Серверная проверка — единственная,
// которой можно доверять; скрытые на клиенте кнопки защитой не являются.

function isAdmin(user) {
  return Boolean(user) && user.role === 'admin';
}

// Владелец — тот, чей id записан в userId. Если userId нет (старые и демо-данные),
// владельца нет и изменять такую запись может только админ.
function isOwner(user, entity) {
  return Boolean(user) && entity.userId != null && entity.userId === user.id;
}

function canModify(user, entity) {
  return isAdmin(user) || isOwner(user, entity);
}

module.exports = { isAdmin, isOwner, canModify };
