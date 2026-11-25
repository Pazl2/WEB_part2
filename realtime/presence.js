// Учёт того, кто сейчас в сети и в каких комнатах.
// Один пользователь может открыть несколько вкладок, у каждой свой socket.id,
// поэтому «пришёл» и «ушёл» считаем по пользователю, а не по соединению:
// уведомление об уходе отправляется только когда закрылась его последняя вкладка.
class Presence {
  constructor() {
    // userId → { id, username, sockets: Set<socketId>, rooms: Map<room, Set<socketId>> }
    this.users = new Map();
  }

  // Регистрирует соединение. Возвращает true, если это первое соединение пользователя.
  connect(socketId, user) {
    let entry = this.users.get(user.id);
    const isFirst = !entry;
    if (!entry) {
      entry = { id: user.id, username: user.username, sockets: new Set(), rooms: new Map() };
      this.users.set(user.id, entry);
    }
    entry.sockets.add(socketId);
    return isFirst;
  }

  // Убирает соединение. Возвращает:
  //   wentOffline — это было последнее соединение пользователя;
  //   leftRooms   — комнаты, в которых у пользователя не осталось ни одной вкладки.
  disconnect(socketId, userId) {
    const entry = this.users.get(userId);
    if (!entry) return { wentOffline: false, leftRooms: [] };

    const leftRooms = [];
    for (const [room, sockets] of entry.rooms) {
      if (sockets.delete(socketId) && sockets.size === 0) {
        entry.rooms.delete(room);
        leftRooms.push(room);
      }
    }
    entry.sockets.delete(socketId);

    const wentOffline = entry.sockets.size === 0;
    if (wentOffline) this.users.delete(userId);
    return { wentOffline, leftRooms };
  }

  // Возвращает true, если пользователь вошёл в комнату впервые (в другой вкладке его там не было)
  join(socketId, userId, room) {
    const entry = this.users.get(userId);
    if (!entry) return false;
    let sockets = entry.rooms.get(room);
    if (!sockets) {
      sockets = new Set();
      entry.rooms.set(room, sockets);
    }
    const isNew = sockets.size === 0;
    sockets.add(socketId);
    return isNew;
  }

  // Возвращает true, если эта вкладка была последней пользователя в комнате
  leave(socketId, userId, room) {
    const entry = this.users.get(userId);
    const sockets = entry && entry.rooms.get(room);
    if (!sockets || !sockets.delete(socketId)) return false;
    if (sockets.size > 0) return false;
    entry.rooms.delete(room);
    return true;
  }

  // socket.id всех вкладок пользователя (по ним доставляются личные сообщения)
  socketIds(userId) {
    const entry = this.users.get(userId);
    return entry ? [...entry.sockets] : [];
  }

  connectionCount(userId) {
    return this.socketIds(userId).length;
  }

  online() {
    return [...this.users.values()].map(({ id, username }) => ({ id, username }));
  }

  members(room) {
    return [...this.users.values()]
      .filter((entry) => entry.rooms.has(room))
      .map(({ id, username }) => ({ id, username }));
  }
}

module.exports = { Presence };
