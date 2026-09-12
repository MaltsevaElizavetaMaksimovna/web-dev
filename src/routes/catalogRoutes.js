/**
 * Маршруты пользовательской части сайта (ЛБ 1 и ЛБ 2).
 *
 * Маршрут отвечает только за приём запроса и выбор страницы для отображения.
 * Проверка данных и работа с базой выполняются в сервисном слое.
 */
'use strict';

const express = require('express');
const linkService = require('../services/linkService');
const topicRepository = require('../repositories/topicRepository');
const logService = require('../services/logService');
const { buildActor } = require('../middleware/auth');

const router = express.Router();

/**
 * Главная страница — каталог ссылок с поиском и фильтрацией.
 * ЛБ 1: постраничный просмотр ссылок.
 * ЛБ 2: фильтрация по темам и поиск.
 */
router.get('/', (req, res) => {
  const data = linkService.getCatalogPage(req.query, false);
  const actor = buildActor(req);

  // В журнал попадает именно то действие, которое выполнил посетитель
  if (data.filters.search) {
    logService.log('SEARCH_QUERY', {
      actor,
      details: { query: data.filters.search, found: data.pagination.total },
    });
  } else if (data.currentTopic) {
    logService.log('TOPIC_FILTER', {
      actor,
      target: { entity: 'topic', id: data.currentTopic.id, title: data.currentTopic.name },
      details: { found: data.pagination.total },
    });
  } else {
    logService.log('CATALOG_VIEW', {
      actor,
      details: { page: data.pagination.page, sort: data.filters.sort },
    });
  }

  res.render('pages/catalog', {
    title: data.currentTopic
      ? `${data.currentTopic.name} — Поисковый каталог`
      : 'Поисковый каталог',
    ...data,
  });
});

/**
 * Страница со списком всех тем каталога.
 */
router.get('/topics', (req, res) => {
  res.render('pages/topics', {
    title: 'Темы каталога — Поисковый каталог',
    topics: topicRepository.findAllWithCounts(),
  });
});

/**
 * Переход по ссылке (ЛБ 1).
 * Увеличивает счётчик переходов, записывает событие в журнал
 * и перенаправляет посетителя на внешний ресурс.
 */
router.get('/go/:id', (req, res) => {
  const result = linkService.handleRedirect(req.params.id, buildActor(req));

  if (!result.ok) {
    return res.status(404).render('pages/error', {
      title: 'Ссылка недоступна',
      status: 404,
      message: result.error,
    });
  }

  res.redirect(result.url);
});

module.exports = router;
