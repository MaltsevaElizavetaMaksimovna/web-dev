/**
 * Слой доступа к базе данных SQLite.
 * Создаёт подключение, включает поддержку внешних ключей
 * и разворачивает схему при первом запуске.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

// Папка data может отсутствовать при первом клонировании проекта
const dataDir = path.dirname(config.paths.database);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Единое подключение к БД на всё приложение
const db = new Database(config.paths.database);

// Режим WAL ускоряет одновременное чтение и запись
db.pragma('journal_mode = WAL');
// Без этой директивы SQLite игнорирует внешние ключи
db.pragma('foreign_keys = ON');

/**
 * Регистрация собственной функции приведения к нижнему регистру.
 *
 * Встроенная функция LOWER() в SQLite обрабатывает только латинские буквы:
 * запрос LOWER('ХАБР') возвращает строку без изменений. Из-за этого поиск
 * по каталогу не находил бы записи, если регистр введённого текста
 * отличается от записанного в базе.
 *
 * Функция RULOWER использует средства JavaScript и корректно работает
 * с кириллицей, поэтому поиск не зависит от регистра букв.
 */
db.function('RULOWER', (value) => (value === null ? null : String(value).toLowerCase()));

/**
 * Создаёт таблицы, если их ещё нет.
 * Вызывается при каждом старте — повторный вызов безопасен.
 */
function initSchema() {
  db.exec(`
    -- Темы каталога (рубрики, по которым группируются ссылки)
    CREATE TABLE IF NOT EXISTS topics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      slug        TEXT    NOT NULL UNIQUE,
      description TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Ссылки каталога
    CREATE TABLE IF NOT EXISTS links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      url         TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      topic_id    INTEGER NOT NULL,
      is_hidden   INTEGER NOT NULL DEFAULT 0,  -- 0 — видима, 1 — скрыта (ЛБ 3)
      clicks      INTEGER NOT NULL DEFAULT 0,  -- счётчик переходов (ЛБ 5)
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT
    );

    -- Администраторы (ЛБ 7: парольная защита)
    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      login         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    -- Индексы для ускорения выборок каталога
    CREATE INDEX IF NOT EXISTS idx_links_topic   ON links(topic_id);
    CREATE INDEX IF NOT EXISTS idx_links_hidden  ON links(is_hidden);
    CREATE INDEX IF NOT EXISTS idx_links_clicks  ON links(clicks DESC);
  `);
}

initSchema();

module.exports = db;
