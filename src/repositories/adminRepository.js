/**
 * Репозиторий администраторов (ЛБ 7 — парольная защита).
 * Пароли в базе хранятся только в виде хеша, открытый текст нигде не сохраняется.
 */
'use strict';

const db = require('../models/database');

/** Возвращает администратора по логину либо undefined. */
function findByLogin(login) {
  return db.prepare('SELECT id, login, password_hash, last_login_at FROM admins WHERE login = ?')
    .get(login);
}

/** Возвращает администратора по идентификатору либо undefined. */
function findById(id) {
  return db.prepare('SELECT id, login, created_at, last_login_at FROM admins WHERE id = ?').get(id);
}

/** Фиксирует время последнего успешного входа. */
function updateLastLogin(id) {
  db.prepare("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

/** Создаёт учётную запись администратора с уже вычисленным хешем пароля. */
function create(login, passwordHash) {
  const result = db.prepare('INSERT INTO admins (login, password_hash) VALUES (?, ?)')
    .run(login, passwordHash);
  return result.lastInsertRowid;
}

module.exports = {
  findByLogin,
  findById,
  updateLastLogin,
  create,
};
