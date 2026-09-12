/**
 * Сервис работы со ссылками — слой бизнес-логики каталога.
 *
 * Маршруты обращаются только к этому модулю: здесь выполняется проверка
 * данных, расчёт постраничного вывода и запись событий в журнал,
 * а обращения к базе делегируются репозиторию.
 */
'use strict';

const linkRepository = require('../repositories/linkRepository');
const topicRepository = require('../repositories/topicRepository');
const validation = require('./validationService');
const logService = require('./logService');
const config = require('../config');

/**
 * Возвращает страницу каталога с учётом фильтров (ЛБ 1 и ЛБ 2).
 *
 * @param {object} query - параметры строки запроса
 * @param {boolean} includeHidden - показывать ли скрытые ссылки (режим админки)
 * @returns {object} данные для отображения страницы
 */
function getCatalogPage(query = {}, includeHidden = false) {
  // Приведение параметров к безопасным значениям
  const search = validation.normalizeSearch(query.search);
  const sort = validation.normalizeSort(query.sort);
  const perPage = includeHidden ? config.pagination.perPageAdmin : config.pagination.perPage;

  // Определение выбранной темы: параметр может отсутствовать или быть некорректным
  let topicId = null;
  let currentTopic = null;

  if (query.topic) {
    const check = validation.validateTopicId(query.topic, topicRepository.exists);
    if (check.valid) {
      topicId = check.value;
      currentTopic = topicRepository.findById(topicId);
    }
  }

  // Сначала считаем общее количество записей, чтобы вычислить число страниц
  const total = linkRepository.countAll({ includeHidden, topicId, search });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = validation.normalizePage(query.page, totalPages);
  const offset = (page - 1) * perPage;

  const links = linkRepository.findAll({
    includeHidden, topicId, search, sort, limit: perPage, offset,
  });

  return {
    links,
    topics: topicRepository.findAllWithCounts(),
    currentTopic,
    filters: { search, sort, topicId },
    pagination: {
      page,
      perPage,
      total,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    },
  };
}

/**
 * Обрабатывает переход по ссылке (ЛБ 1).
 * Увеличивает счётчик переходов и записывает событие в журнал.
 *
 * @returns {{ok: boolean, url?: string, error?: string}}
 */
function handleRedirect(rawId, actor) {
  const check = validation.validateId(rawId);
  if (!check.valid) {
    return { ok: false, error: 'Некорректный идентификатор ссылки.' };
  }

  const link = linkRepository.findById(check.value);
  if (!link) {
    return { ok: false, error: 'Ссылка не найдена.' };
  }

  // Скрытые ссылки недоступны для перехода обычным посетителям
  if (link.is_hidden) {
    logService.log('ACCESS_DENIED', {
      actor,
      target: { entity: 'link', id: link.id, title: link.title },
      details: { reason: 'Попытка перехода по скрытой ссылке' },
    });
    return { ok: false, error: 'Эта ссылка недоступна.' };
  }

  linkRepository.incrementClicks(link.id);

  logService.log('LINK_CLICK', {
    actor,
    target: { entity: 'link', id: link.id, title: link.title },
    details: { url: link.url, topic: link.topic_name },
  });

  return { ok: true, url: link.url };
}

/**
 * Добавляет новую ссылку (ЛБ 4).
 *
 * @returns {{ok: boolean, id?: number, errors?: string[]}}
 */
function createLink(body, actor) {
  const result = validation.validateLinkForm(body, topicRepository.exists);

  if (!result.valid) {
    logService.log('VALIDATION_ERROR', {
      actor,
      details: { form: 'Добавление ссылки', errors: result.errors },
    });
    return { ok: false, errors: result.errors };
  }

  // Повторное добавление того же адреса не допускается
  const duplicate = linkRepository.findByUrl(result.data.url);
  if (duplicate) {
    const message = `Ссылка с таким адресом уже есть в каталоге: «${duplicate.title}».`;
    logService.log('VALIDATION_ERROR', {
      actor,
      details: { form: 'Добавление ссылки', errors: [message] },
    });
    return { ok: false, errors: [message] };
  }

  const id = linkRepository.create(result.data);

  logService.log('LINK_CREATE', {
    actor,
    target: { entity: 'link', id, title: result.data.title },
    details: { url: result.data.url, isHidden: result.data.isHidden },
  });

  return { ok: true, id };
}

/**
 * Изменяет существующую ссылку.
 *
 * @returns {{ok: boolean, errors?: string[]}}
 */
function updateLink(rawId, body, actor) {
  const idCheck = validation.validateId(rawId);
  if (!idCheck.valid) return { ok: false, errors: idCheck.errors };

  const existing = linkRepository.findById(idCheck.value);
  if (!existing) return { ok: false, errors: ['Ссылка не найдена.'] };

  const result = validation.validateLinkForm(body, topicRepository.exists);
  if (!result.valid) {
    logService.log('VALIDATION_ERROR', {
      actor,
      details: { form: 'Изменение ссылки', errors: result.errors },
    });
    return { ok: false, errors: result.errors };
  }

  // Адрес может совпадать только с адресом самой изменяемой записи
  const duplicate = linkRepository.findByUrl(result.data.url);
  if (duplicate && duplicate.id !== idCheck.value) {
    const message = `Этот адрес уже используется ссылкой «${duplicate.title}».`;
    return { ok: false, errors: [message] };
  }

  linkRepository.update(idCheck.value, result.data);

  logService.log('LINK_UPDATE', {
    actor,
    target: { entity: 'link', id: idCheck.value, title: result.data.title },
    details: { previousTitle: existing.title },
  });

  return { ok: true };
}

/**
 * Удаляет ссылку (ЛБ 4).
 *
 * @returns {{ok: boolean, error?: string}}
 */
function deleteLink(rawId, actor) {
  const check = validation.validateId(rawId);
  if (!check.valid) return { ok: false, error: 'Некорректный идентификатор ссылки.' };

  const link = linkRepository.findById(check.value);
  if (!link) return { ok: false, error: 'Ссылка не найдена.' };

  linkRepository.remove(check.value);

  logService.log('LINK_DELETE', {
    actor,
    target: { entity: 'link', id: link.id, title: link.title },
    details: { url: link.url, clicks: link.clicks },
  });

  return { ok: true };
}

/**
 * Переключает видимость ссылки (ЛБ 3).
 *
 * @returns {{ok: boolean, isHidden?: boolean, error?: string}}
 */
function toggleVisibility(rawId, actor) {
  const check = validation.validateId(rawId);
  if (!check.valid) return { ok: false, error: 'Некорректный идентификатор ссылки.' };

  const link = linkRepository.findById(check.value);
  if (!link) return { ok: false, error: 'Ссылка не найдена.' };

  const newValue = linkRepository.toggleVisibility(check.value);

  logService.log('LINK_VISIBILITY_TOGGLE', {
    actor,
    target: { entity: 'link', id: link.id, title: link.title },
    details: { isHidden: Boolean(newValue) },
  });

  return { ok: true, isHidden: Boolean(newValue) };
}

/**
 * Формирует данные для страницы рейтинга ссылок (ЛБ 5).
 */
function getRating(query = {}) {
  const limitRaw = Number(validation.toTrimmedString(query.limit));
  // Допустимые значения ограничены списком, чтобы исключить произвольные числа
  const limit = [10, 20, 50].includes(limitRaw) ? limitRaw : 10;

  const topLinks = linkRepository.findTopByClicks(limit, true);
  const statistics = linkRepository.getStatistics();
  const byTopic = linkRepository.getClicksByTopic();

  // Максимум нужен для построения горизонтальной диаграммы
  const maxClicks = topLinks.length ? topLinks[0].clicks : 0;
  const maxTopicClicks = byTopic.length
    ? Math.max(...byTopic.map((t) => t.total_clicks))
    : 0;

  return { topLinks, statistics, byTopic, limit, maxClicks, maxTopicClicks };
}

/** Возвращает одну ссылку по идентификатору (для формы изменения). */
function getLinkById(rawId) {
  const check = validation.validateId(rawId);
  if (!check.valid) return null;
  return linkRepository.findById(check.value) || null;
}

module.exports = {
  getCatalogPage,
  handleRedirect,
  createLink,
  updateLink,
  deleteLink,
  toggleVisibility,
  getRating,
  getLinkById,
};
