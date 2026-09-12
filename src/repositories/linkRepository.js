/**
 * Репозиторий ссылок — единственное место, где выполняются SQL-запросы к таблице links.
 * Верхние слои (сервисы, маршруты) работают только с методами этого модуля
 * и ничего не знают о структуре запросов.
 */
'use strict';

const db = require('../models/database');

// Общая часть выборки: к каждой ссылке присоединяется название её темы
const SELECT_BASE = `
  SELECT
    l.id, l.title, l.url, l.description, l.topic_id, l.is_hidden, l.clicks,
    l.created_at, l.updated_at,
    t.name AS topic_name, t.slug AS topic_slug
  FROM links l
  JOIN topics t ON t.id = l.topic_id
`;

/**
 * Возвращает страницу списка ссылок с учётом фильтров.
 * @param {object} options
 * @param {boolean} options.includeHidden - включать ли скрытые ссылки (для админки)
 * @param {number|null} options.topicId - идентификатор темы или null (все темы)
 * @param {string} options.search - строка поиска по названию и описанию
 * @param {string} options.sort - порядок сортировки: 'new' | 'popular' | 'title'
 * @param {number} options.limit - количество записей на странице
 * @param {number} options.offset - сколько записей пропустить
 * @returns {Array<object>} массив ссылок
 */
function findAll({ includeHidden = false, topicId = null, search = '', sort = 'new', limit = 9, offset = 0 } = {}) {
  const conditions = [];
  const params = {};

  // Обычный посетитель видит только открытые ссылки
  if (!includeHidden) conditions.push('l.is_hidden = 0');

  if (topicId) {
    conditions.push('l.topic_id = @topicId');
    params.topicId = topicId;
  }

  // Поиск по названию и описанию без учёта регистра
  if (search) {
    conditions.push('(LOWER(l.title) LIKE @search OR LOWER(l.description) LIKE @search)');
    params.search = `%${search.toLowerCase()}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = buildOrderBy(sort);

  params.limit = limit;
  params.offset = offset;

  return db.prepare(`${SELECT_BASE} ${where} ${orderBy} LIMIT @limit OFFSET @offset`).all(params);
}

/**
 * Подсчитывает общее количество ссылок, подходящих под фильтры.
 * Используется для расчёта числа страниц при постраничном выводе.
 */
function countAll({ includeHidden = false, topicId = null, search = '' } = {}) {
  const conditions = [];
  const params = {};

  if (!includeHidden) conditions.push('is_hidden = 0');

  if (topicId) {
    conditions.push('topic_id = @topicId');
    params.topicId = topicId;
  }

  if (search) {
    conditions.push('(LOWER(title) LIKE @search OR LOWER(description) LIKE @search)');
    params.search = `%${search.toLowerCase()}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT COUNT(*) AS total FROM links ${where}`).get(params).total;
}

/** Возвращает одну ссылку по идентификатору либо undefined, если её нет. */
function findById(id) {
  return db.prepare(`${SELECT_BASE} WHERE l.id = ?`).get(id);
}

/** Проверяет, существует ли ссылка с таким адресом (защита от дубликатов). */
function findByUrl(url) {
  return db.prepare('SELECT id, title FROM links WHERE url = ?').get(url);
}

/**
 * Добавляет новую ссылку (ЛБ 4).
 * @returns {number} идентификатор созданной записи
 */
function create({ title, url, description, topicId, isHidden = false }) {
  const result = db.prepare(`
    INSERT INTO links (title, url, description, topic_id, is_hidden)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, url, description, topicId, isHidden ? 1 : 0);

  return result.lastInsertRowid;
}

/** Обновляет поля существующей ссылки. */
function update(id, { title, url, description, topicId, isHidden }) {
  db.prepare(`
    UPDATE links
    SET title = ?, url = ?, description = ?, topic_id = ?, is_hidden = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(title, url, description, topicId, isHidden ? 1 : 0, id);
}

/**
 * Удаляет ссылку (ЛБ 4).
 * @returns {boolean} true, если запись действительно была удалена
 */
function remove(id) {
  const result = db.prepare('DELETE FROM links WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Переключает видимость ссылки (ЛБ 3).
 * @returns {number|null} новое значение признака или null, если записи нет
 */
function toggleVisibility(id) {
  const link = db.prepare('SELECT is_hidden FROM links WHERE id = ?').get(id);
  if (!link) return null;

  const newValue = link.is_hidden ? 0 : 1;
  db.prepare("UPDATE links SET is_hidden = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newValue, id);

  return newValue;
}

/** Увеличивает счётчик переходов по ссылке на единицу (ЛБ 1 и ЛБ 5). */
function incrementClicks(id) {
  db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(id);
}

/**
 * Возвращает ссылки, отсортированные по числу переходов (ЛБ 5 — рейтинг).
 * @param {number} limit - сколько записей вернуть
 * @param {boolean} includeHidden - учитывать ли скрытые ссылки
 */
function findTopByClicks(limit = 10, includeHidden = true) {
  const where = includeHidden ? '' : 'WHERE l.is_hidden = 0';
  return db.prepare(`${SELECT_BASE} ${where} ORDER BY l.clicks DESC, l.title ASC LIMIT ?`).all(limit);
}

/** Сводная статистика каталога для страницы рейтинга (ЛБ 5). */
function getStatistics() {
  return db.prepare(`
    SELECT
      COUNT(*)                              AS total_links,
      SUM(CASE WHEN is_hidden = 1 THEN 1 ELSE 0 END) AS hidden_links,
      SUM(clicks)                           AS total_clicks,
      ROUND(AVG(clicks), 1)                 AS average_clicks,
      MAX(clicks)                           AS max_clicks
    FROM links
  `).get();
}

/** Распределение переходов по темам — для диаграммы на странице рейтинга (ЛБ 5). */
function getClicksByTopic() {
  return db.prepare(`
    SELECT
      t.id, t.name, t.slug,
      COUNT(l.id)              AS links_count,
      COALESCE(SUM(l.clicks), 0) AS total_clicks
    FROM topics t
    LEFT JOIN links l ON l.topic_id = t.id
    GROUP BY t.id
    ORDER BY total_clicks DESC
  `).all();
}

/** Формирует фрагмент ORDER BY по названию режима сортировки. */
function buildOrderBy(sort) {
  switch (sort) {
    case 'popular': return 'ORDER BY l.clicks DESC, l.title ASC';
    case 'title':   return 'ORDER BY l.title ASC';
    case 'old':     return 'ORDER BY l.id ASC';
    default:        return 'ORDER BY l.id DESC'; // 'new' — сначала новые
  }
}

module.exports = {
  findAll,
  countAll,
  findById,
  findByUrl,
  create,
  update,
  remove,
  toggleVisibility,
  incrementClicks,
  findTopByClicks,
  getStatistics,
  getClicksByTopic,
};
