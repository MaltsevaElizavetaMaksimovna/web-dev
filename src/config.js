/**
 * Конфигурация приложения «Поисковый каталог».
 * Все значения можно переопределить через переменные окружения,
 * что позволяет менять параметры в процессе тестирования без правки кода.
 */
'use strict';

const path = require('path');

// Корневая папка проекта (на уровень выше папки src)
const ROOT = path.join(__dirname, '..');

module.exports = {
  // --- Сервер ---
  port: Number(process.env.PORT) || 3000,

  // --- Пути к файлам ---
  paths: {
    root: ROOT,
    database: path.join(ROOT, 'data', 'catalog.db'),   // файл БД SQLite
    sessions: path.join(ROOT, 'data'),                 // хранилище сессий
    logsDir: path.join(ROOT, 'logs'),                  // папка журналов
    logFile: path.join(ROOT, 'logs', 'actions.json'),  // основной журнал действий
  },

  // --- Сессии (ЛБ 7: парольная защита) ---
  session: {
    secret: process.env.SESSION_SECRET || 'poisk-catalog-secret-8vm61',
    maxAgeMinutes: Number(process.env.SESSION_MAX_AGE) || 60, // время жизни сессии
  },

  // --- Учётная запись администратора по умолчанию ---
  admin: {
    login: process.env.ADMIN_LOGIN || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },

  // --- Пагинация каталога (ЛБ 1) ---
  pagination: {
    perPage: Number(process.env.PER_PAGE) || 9,  // карточек на странице
    perPageAdmin: 15,                            // строк в админской таблице
    perPageLogs: 25,                             // записей журнала на странице
  },

  // --- Журналирование (ЛБ 6) ---
  logging: {
    maxFileSizeBytes: 512 * 1024, // 512 КБ — порог ротации файла журнала
    maxArchiveFiles: 5,           // сколько архивных файлов хранить
  },

  // --- Ограничения валидации ---
  validation: {
    titleMaxLength: 120,
    descriptionMaxLength: 500,
    urlMaxLength: 500,
    searchMaxLength: 100,
  },
};
