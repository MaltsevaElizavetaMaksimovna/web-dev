/**
 * Маршруты административной части сайта.
 *
 * ЛБ 3 — просмотр каталога ссылок, включая скрытые;
 * ЛБ 4 — добавление, изменение и удаление ссылок;
 * ЛБ 5 — рейтинг ссылок и статистика переходов;
 * ЛБ 6 — просмотр журнала действий пользователей;
 * ЛБ 7 — вход по паролю и защита всех служебных страниц.
 */
'use strict';

const express = require('express');
const linkService = require('../services/linkService');
const authService = require('../services/authService');
const logService = require('../services/logService');
const topicRepository = require('../repositories/topicRepository');
const validation = require('../services/validationService');
const config = require('../config');
const { requireAuth, redirectIfAuthenticated, buildActor } = require('../middleware/auth');

const router = express.Router();

/* ========================================================================== */
/*  ЛБ 7. Вход в административную панель                                      */
/* ========================================================================== */

/** Страница с формой входа. */
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('admin/login', {
    title: 'Вход в панель управления',
    errors: [],
    login: '',
  });
});

/** Обработка отправленной формы входа. */
router.post('/login', redirectIfAuthenticated, (req, res) => {
  const result = authService.login(req.body.login, req.body.password, req.ip);

  if (!result.ok) {
    // Форма выводится повторно с сохранением введённого логина
    return res.status(401).render('admin/login', {
      title: 'Вход в панель управления',
      errors: result.errors,
      login: validation.toTrimmedString(req.body.login),
    });
  }

  // Сведения о вошедшем администраторе сохраняются в сессии
  req.session.admin = result.admin;

  // Возврат на страницу, которую администратор запрашивал до входа
  const returnTo = req.session.returnTo || '/admin';
  delete req.session.returnTo;

  req.setFlash('success', `Добро пожаловать, ${result.admin.login}.`);
  res.redirect(returnTo);
});

/** Выход из панели управления. */
router.get('/logout', (req, res) => {
  if (req.session.admin) {
    authService.logout(buildActor(req));
  }

  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

/* ========================================================================== */
/*  Все последующие маршруты доступны только после входа (ЛБ 7)               */
/* ========================================================================== */
router.use(requireAuth);

/* ========================================================================== */
/*  ЛБ 3. Просмотр каталога ссылок, включая скрытые                           */
/* ========================================================================== */
router.get('/', (req, res) => {
  // Признак includeHidden = true включает в выборку скрытые ссылки
  const data = linkService.getCatalogPage(req.query, true);

  logService.log('ADMIN_VIEW_LINKS', {
    actor: buildActor(req),
    details: { page: data.pagination.page, total: data.pagination.total },
  });

  res.render('admin/links', {
    title: 'Каталог ссылок — панель управления',
    ...data,
  });
});

/* ========================================================================== */
/*  ЛБ 3. Переключение видимости ссылки                                       */
/* ========================================================================== */
router.post('/links/:id/toggle', (req, res) => {
  const result = linkService.toggleVisibility(req.params.id, buildActor(req));

  if (!result.ok) {
    req.setFlash('error', result.error);
  } else {
    req.setFlash('success', result.isHidden
      ? 'Ссылка скрыта из каталога.'
      : 'Ссылка снова видна посетителям.');
  }

  // Возврат на ту же страницу списка, с которой была нажата кнопка
  res.redirect(req.body.returnTo || '/admin');
});

/* ========================================================================== */
/*  ЛБ 4. Добавление ссылки                                                   */
/* ========================================================================== */

/** Страница с формой добавления. */
router.get('/links/new', (req, res) => {
  res.render('admin/link-form', {
    title: 'Добавление ссылки — панель управления',
    topics: topicRepository.findAll(),
    errors: [],
    link: null,          // признак режима добавления
    formData: { title: '', url: '', description: '', topicId: '', isHidden: false },
  });
});

/** Обработка формы добавления. */
router.post('/links/new', (req, res) => {
  const result = linkService.createLink(req.body, buildActor(req));

  if (!result.ok) {
    // При ошибке форма выводится повторно с ранее введёнными значениями
    return res.status(400).render('admin/link-form', {
      title: 'Добавление ссылки — панель управления',
      topics: topicRepository.findAll(),
      errors: result.errors,
      link: null,
      formData: {
        title: validation.toTrimmedString(req.body.title),
        url: validation.toTrimmedString(req.body.url),
        description: validation.toTrimmedString(req.body.description),
        topicId: validation.toTrimmedString(req.body.topicId),
        isHidden: req.body.isHidden === 'on',
      },
    });
  }

  req.setFlash('success', 'Ссылка добавлена в каталог.');
  res.redirect('/admin');
});

/* ========================================================================== */
/*  ЛБ 4. Изменение ссылки                                                    */
/* ========================================================================== */

/** Страница с формой изменения. */
router.get('/links/:id/edit', (req, res) => {
  const link = linkService.getLinkById(req.params.id);

  if (!link) {
    req.setFlash('error', 'Ссылка не найдена.');
    return res.redirect('/admin');
  }

  res.render('admin/link-form', {
    title: 'Изменение ссылки — панель управления',
    topics: topicRepository.findAll(),
    errors: [],
    link,               // признак режима изменения
    formData: {
      title: link.title,
      url: link.url,
      description: link.description,
      topicId: String(link.topic_id),
      isHidden: Boolean(link.is_hidden),
    },
  });
});

/** Обработка формы изменения. */
router.post('/links/:id/edit', (req, res) => {
  const result = linkService.updateLink(req.params.id, req.body, buildActor(req));

  if (!result.ok) {
    const link = linkService.getLinkById(req.params.id);

    if (!link) {
      req.setFlash('error', 'Ссылка не найдена.');
      return res.redirect('/admin');
    }

    return res.status(400).render('admin/link-form', {
      title: 'Изменение ссылки — панель управления',
      topics: topicRepository.findAll(),
      errors: result.errors,
      link,
      formData: {
        title: validation.toTrimmedString(req.body.title),
        url: validation.toTrimmedString(req.body.url),
        description: validation.toTrimmedString(req.body.description),
        topicId: validation.toTrimmedString(req.body.topicId),
        isHidden: req.body.isHidden === 'on',
      },
    });
  }

  req.setFlash('success', 'Изменения сохранены.');
  res.redirect('/admin');
});

/* ========================================================================== */
/*  ЛБ 4. Удаление ссылки                                                     */
/* ========================================================================== */
router.post('/links/:id/delete', (req, res) => {
  const result = linkService.deleteLink(req.params.id, buildActor(req));

  if (!result.ok) {
    req.setFlash('error', result.error);
  } else {
    req.setFlash('success', 'Ссылка удалена из каталога.');
  }

  res.redirect(req.body.returnTo || '/admin');
});

/* ========================================================================== */
/*  ЛБ 5. Рейтинг ссылок                                                      */
/* ========================================================================== */
router.get('/rating', (req, res) => {
  const data = linkService.getRating(req.query);

  logService.log('ADMIN_VIEW_RATING', {
    actor: buildActor(req),
    details: { limit: data.limit },
  });

  res.render('admin/rating', {
    title: 'Рейтинг ссылок — панель управления',
    ...data,
  });
});

/* ========================================================================== */
/*  ЛБ 6. Журнал действий пользователей                                       */
/* ========================================================================== */
router.get('/logs', (req, res) => {
  const page = Number(validation.toTrimmedString(req.query.page)) || 1;

  const data = logService.read({
    action: validation.toTrimmedString(req.query.action),
    level: validation.toTrimmedString(req.query.level),
    dateFrom: validation.toTrimmedString(req.query.dateFrom),
    dateTo: validation.toTrimmedString(req.query.dateTo),
    page,
    perPage: config.pagination.perPageLogs,
  });

  const summary = logService.getSummary();

  logService.log('ADMIN_VIEW_LOGS', {
    actor: buildActor(req),
    details: { total: data.total },
  });

  res.render('admin/logs', {
    title: 'Журнал действий — панель управления',
    entries: data.entries,
    pagination: {
      page: data.page,
      totalPages: data.totalPages,
      total: data.total,
      hasPrev: data.page > 1,
      hasNext: data.page < data.totalPages,
    },
    summary,
    actions: logService.ACTIONS,
    filters: {
      action: validation.toTrimmedString(req.query.action),
      level: validation.toTrimmedString(req.query.level),
      dateFrom: validation.toTrimmedString(req.query.dateFrom),
      dateTo: validation.toTrimmedString(req.query.dateTo),
    },
  });
});

/** Очистка журнала действий. */
router.post('/logs/clear', (req, res) => {
  const cleared = logService.clear();

  if (cleared) {
    req.setFlash('success', 'Журнал действий очищен.');
  } else {
    req.setFlash('error', 'Не удалось очистить журнал действий.');
  }

  res.redirect('/admin/logs');
});

module.exports = router;
