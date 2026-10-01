const fs = require('fs');
const path = require('path');

// папка и файл для хранения логов на сервере
const logDir = path.join(__dirname, '..', 'logs');
fs.mkdirSync(logDir, { recursive: true });

const logStream = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' });

// пишет строку лога в консоль и дописывает её в файл
function writeLog(level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
  logStream.write(line + '\n');
}

module.exports = { writeLog };
