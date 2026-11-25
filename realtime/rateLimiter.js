// Ограничение частоты событий: не более `max` событий за скользящее окно `windowMs`.
// Ключ — пользователь, а не соединение: иначе лимит обходится открытием новых вкладок.
// Счётчики хранятся в памяти процесса. Для нескольких серверов нужно общее хранилище
// (например, Redis), для учебного проекта с одним процессом этого достаточно.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // key → метки времени последних событий

  function prune(timestamps, now) {
    while (timestamps.length > 0 && timestamps[0] <= now - windowMs) timestamps.shift();
  }

  // Раз в окно удаляем ключи, по которым давно ничего не было, чтобы Map не росла
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      prune(timestamps, now);
      if (timestamps.length === 0) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref(); // таймер не удерживает процесс от завершения

  return {
    // Возвращает { allowed, retryAfterMs }. Разрешённое событие сразу учитывается.
    consume(key) {
      const now = Date.now();
      let timestamps = hits.get(key);
      if (!timestamps) {
        timestamps = [];
        hits.set(key, timestamps);
      }
      prune(timestamps, now);
      if (timestamps.length >= max) {
        return { allowed: false, retryAfterMs: timestamps[0] + windowMs - now };
      }
      timestamps.push(now);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

module.exports = { createRateLimiter };
