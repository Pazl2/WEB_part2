const fs = require('fs');
const path = require('path');

// папка и файл для хранения логов на сервере
const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'server.log');
fs.mkdirSync(logDir, { recursive: true });

// открытый дескриптор файла лога (null — файл сейчас не открыт)
let fd = null;
// был ли файл лога недоступен при прошлой проверке (нужно, чтобы не спамить в консоль)
let wasBroken = false;
// ошибка последней неудавшейся записи (сбрасывается после первой успешной записи)
let writeError = null;

function closeFd() {
  if (fd !== null) {
    try {
      fs.closeSync(fd);
    } catch (err) {
      // дескриптор уже недействителен — игнорируем
    }
    fd = null;
  }
}

// true, если открытый дескриптор указывает не на тот файл, что лежит сейчас по пути logFile
// (например, лог удалили и создали заново — старый дескриптор пишет «в никуда»)
function isStaleDescriptor() {
  const onDisk = fs.statSync(logFile);
  const opened = fs.fstatSync(fd);
  return onDisk.ino && opened.ino && onDisk.ino !== opened.ino;
}

// проверяет, что файл лога существует и доступен для записи.
// Удалённый во время работы файл автоматически НЕ создаётся заново:
// пока он не восстановлен, сервер отвечает 503.
function checkLogFile() {
  try {
    fs.accessSync(logFile, fs.constants.F_OK | fs.constants.W_OK);
    // access не отличает файл от папки: если на месте лога лежит папка, это ошибка
    if (!fs.statSync(logFile).isFile()) {
      const err = new Error(`${logFile} не является обычным файлом`);
      err.code = 'EISDIR';
      throw err;
    }
    if (fd !== null && isStaleDescriptor()) {
      closeFd();
    }
    if (fd === null) {
      fd = fs.openSync(logFile, 'a');
    }
    return { ok: true, error: null };
  } catch (err) {
    closeFd();
    return { ok: false, error: err };
  }
}

// проверяет файл и сообщает в консоль о смене состояния (а не на каждый запрос)
function getLogStatus() {
  let status = checkLogFile();
  if (status.ok && writeError) {
    status = { ok: false, error: writeError };
  }
  if (!status.ok && !wasBroken) {
    console.error(
      `[${new Date().toISOString()}] [ERROR] Файл лога недоступен (${logFile}): ${status.error.code || status.error.message}`
    );
  } else if (status.ok && wasBroken) {
    console.log(`[${new Date().toISOString()}] [INFO] Файл лога снова доступен`);
  }
  wasBroken = !status.ok;
  return status;
}

// при старте файл создаётся, если его ещё нет (если не получилось — сервер сразу ответит 503)
try {
  fs.closeSync(fs.openSync(logFile, 'a'));
} catch (err) {
  // ошибка будет зафиксирована проверкой ниже
}
getLogStatus();

// пишет строку лога в консоль и дописывает её в файл
function writeLog(level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
  // в файл пишем только если он на месте; иначе строка остаётся лишь в консоли.
  // Проверяем именно файл (а не writeError), чтобы после сбоя запись могла повториться
  const fileStatus = checkLogFile();
  if (!fileStatus.ok) {
    getLogStatus();
    return;
  }
  try {
    fs.writeSync(fd, line + '\n');
    writeError = null;
  } catch (err) {
    // запись не удалась (диск полон, нет прав и т.д.) — ближайшая проверка вернёт 503
    writeError = err;
    closeFd();
  }
}

module.exports = { writeLog, getLogStatus, logFile };
