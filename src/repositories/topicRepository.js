/**
 * Репозиторий тем каталога.
 * Содержит все SQL-запросы к таблице topics.
 */
'use strict';

const db = require('../models/database');

/**
 * Возвращает все темы вместе с количеством видимых ссылок в каждой.
 * Используется для панели фильтрации (ЛБ 2).
 */
function findAllWithCounts() {
  return db.prepare(`
    SELECT
      t.id, t.name, t.slug, t.description,
      COUNT(CASE WHEN l.is_hidden = 0 THEN 1 END) AS links_count
    FROM topics t
    LEFT JOIN links l ON l.topic_id = t.id
    GROUP BY t.id
    ORDER BY t.name ASC
  `).all();
}

/** Возвращает список всех тем без подсчёта ссылок (для выпадающих списков). */
function findAll() {
  return db.prepare('SELECT id, name, slug, description FROM topics ORDER BY name ASC').all();
}

/** Возвращает тему по идентификатору либо undefined. */
function findById(id) {
  return db.prepare('SELECT id, name, slug, description FROM topics WHERE id = ?').get(id);
}

/** Возвращает тему по её строковому коду (slug) либо undefined. */
function findBySlug(slug) {
  return db.prepare('SELECT id, name, slug, description FROM topics WHERE slug = ?').get(slug);
}

/** Проверяет существование темы с указанным идентификатором. */
function exists(id) {
  return Boolean(db.prepare('SELECT 1 FROM topics WHERE id = ?').get(id));
}

module.exports = {
  findAllWithCounts,
  findAll,
  findById,
  findBySlug,
  exists,
};
