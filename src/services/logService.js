/**
 * Сервис журналирования действий пользователя (ЛБ 6).
 *
 * Журнал ведётся в формате JSON Lines: каждая запись — отдельная строка
 * с корректным JSON-объектом. Такой формат позволяет дописывать записи
 * без перечитывания всего файла и не портит журнал при аварийной остановке.
 *
 * Все записи имеют единую структуру, а перечень возможных действий
 * ограничен словарём ACTIONS — это исключает произвольные названия
 * и делает журнал пригодным для фильтрации и анализа.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

// --- Словарь кодов действий -------------------------------------------------
// Ключ — код, который попадает в журнал; значение — описание для интерфейса.
const ACTIONS = {
  // Действия посетителя каталога
  CATALOG_VIEW:    'Просмотр каталога',
  LINK_CLICK:      'Переход по ссылке',
  TOPIC_FILTER:    'Фильтрация по теме',
  SEARCH_QUERY:    'Поиск по каталогу',

  // Действия администратора
  ADMIN_LOGIN_SUCCESS:     'Успешный вход в панель',
  ADMIN_LOGIN_FAIL:        'Неудачная попытка входа',
  ADMIN_LOGOUT:            'Выход из панели',
  ADMIN_VIEW_LINKS:        'Просмотр каталога в панели',
  ADMIN_VIEW_RATING:       'Просмотр рейтинга ссылок',
  ADMIN_VIEW_LOGS:         'Просмотр журнала действий',
  LINK_CREATE:             'Добавление ссылки',
  LINK_UPDATE:             'Изменение ссылки',
  LINK_DELETE:             'Удаление ссылки',
  LINK_VISIBILITY_TOGGLE:  'Изменение видимости ссылки',

  // Служебные события
  VALIDATION_ERROR: 'Ошибка проверки данных',
  ACCESS_DENIED:    'Отказано в доступе',
  SERVER_ERROR:     'Ошибка сервера',
};

// Уровни важности записей
const LEVELS = {
  INFO:    'info',
  WARNING: 'warning',
  ERROR:   'error',
};

// Действия, которые записываются с повышенным уровнем важности
const WARNING_ACTIONS = new Set(['ADMIN_LOGIN_FAIL', 'ACCESS_DENIED', 'VALIDATION_ERROR']);
const ERROR_ACTIONS = new Set(['SERVER_ERROR']);

/** Создаёт папку журналов, если её ещё нет. */
function ensureLogDir() {
  if (!fs.existsSync(config.paths.logsDir)) {
    fs.mkdirSync(config.paths.logsDir, { recursive: true });
  }
}

/**
 * Переносит текущий журнал в архив, если он превысил допустимый размер.
 * Старые архивы сверх установленного лимита удаляются.
 */
function rotateIfNeeded() {
  const file = config.paths.logFile;
  if (!fs.existsSync(file)) return;

  const { size } = fs.statSync(file);
  if (size < config.logging.maxFileSizeBytes) return;

  // Имя архива содержит дату и время, поэтому файлы не перезаписывают друг друга
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archive = path.join(config.paths.logsDir, `actions-${stamp}.json`);
  fs.renameSync(file, archive);

  // Удаление самых старых архивов
  const archives = fs.readdirSync(config.paths.logsDir)
    .filter((name) => name.startsWith('actions-') && name.endsWith('.json'))
    .sort()
    .reverse();

  for (const name of archives.slice(config.logging.maxArchiveFiles)) {
    fs.unlinkSync(path.join(config.paths.logsDir, name));
  }
}

/** Определяет уровень важности по коду действия. */
function resolveLevel(action) {
  if (ERROR_ACTIONS.has(action)) return LEVELS.ERROR;
  if (WARNING_ACTIONS.has(action)) return LEVELS.WARNING;
  return LEVELS.INFO;
}

/** Форматирует дату в виде ДД.ММ.ГГГГ. */
function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/** Форматирует время в виде ЧЧ:ММ:СС. */
function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

/**
 * Записывает действие в журнал.
 *
 * @param {string} action - код действия из словаря ACTIONS
 * @param {object} payload
 * @param {object} [payload.actor]   - кто выполнил действие: { type, login, ip }
 * @param {object} [payload.target]  - над чем выполнено: { entity, id, title }
 * @param {object} [payload.details] - дополнительные сведения произвольной формы
 */
function log(action, { actor = {}, target = null, details = null } = {}) {
  // Неизвестный код действия не должен молча попасть в журнал
  if (!ACTIONS[action]) {
    console.warn(`[logService] Неизвестный код действия: ${action}`);
    return;
  }

  const now = new Date();
  const entry = {
    timestamp: now.toISOString(),        // машинная метка времени
    date: formatDate(now),               // дата для отображения в таблице
    time: formatTime(now),               // время для отображения в таблице
    level: resolveLevel(action),
    action,                              // код действия
    actionLabel: ACTIONS[action],        // описание действия на русском языке
    actor: {
      type: actor.type || 'guest',       // guest — посетитель, admin — администратор
      login: actor.login || null,
      ip: actor.ip || null,
    },
    target,
    details,
  };

  try {
    ensureLogDir();
    rotateIfNeeded();
    // Формат JSON Lines: одна запись — одна строка файла
    fs.appendFileSync(config.paths.logFile, JSON.stringify(entry) + '\n', 'utf8');
  } catch (error) {
    // Сбой журналирования не должен приводить к отказу всего приложения
    console.error('[logService] Не удалось записать событие в журнал:', error.message);
  }
}

/**
 * Читает журнал и возвращает записи с учётом фильтров и постраничного вывода.
 *
 * @param {object} options
 * @param {string} [options.action]   - код действия для фильтрации
 * @param {string} [options.level]    - уровень важности
 * @param {string} [options.dateFrom] - начало периода в формате ГГГГ-ММ-ДД
 * @param {string} [options.dateTo]   - конец периода в формате ГГГГ-ММ-ДД
 * @param {number} [options.page]     - номер страницы, начиная с 1
 * @param {number} [options.perPage]  - количество записей на странице
 * @returns {{entries: Array, total: number, page: number, totalPages: number}}
 */
function read({ action = '', level = '', dateFrom = '', dateTo = '', page = 1, perPage = 25 } = {}) {
  let entries = [];

  try {
    if (fs.existsSync(config.paths.logFile)) {
      const raw = fs.readFileSync(config.paths.logFile, 'utf8');
      entries = raw
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null; // повреждённая строка пропускается
          }
        })
        .filter(Boolean);
    }
  } catch (error) {
    console.error('[logService] Не удалось прочитать журнал:', error.message);
  }

  // Новые записи показываются первыми
  entries.reverse();

  // --- Применение фильтров ---
  if (action) entries = entries.filter((e) => e.action === action);
  if (level) entries = entries.filter((e) => e.level === level);

  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() >= from);
  }

  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59`).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() <= to);
  }

  // --- Постраничный вывод ---
  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * perPage;

  return {
    entries: entries.slice(offset, offset + perPage),
    total,
    page: safePage,
    totalPages,
  };
}

/** Возвращает сводку по журналу: количество записей каждого уровня и действия. */
function getSummary() {
  const { entries } = read({ perPage: Number.MAX_SAFE_INTEGER });

  const byLevel = { info: 0, warning: 0, error: 0 };
  const byAction = {};

  for (const entry of entries) {
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
  }

  return { total: entries.length, byLevel, byAction };
}

/** Полностью очищает журнал действий. */
function clear() {
  try {
    if (fs.existsSync(config.paths.logFile)) {
      fs.unlinkSync(config.paths.logFile);
    }
    return true;
  } catch (error) {
    console.error('[logService] Не удалось очистить журнал:', error.message);
    return false;
  }
}

module.exports = {
  log,
  read,
  getSummary,
  clear,
  ACTIONS,
  LEVELS,
};
