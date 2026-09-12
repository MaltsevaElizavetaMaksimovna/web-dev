/**
 * Промежуточные обработчики проверки доступа (ЛБ 7).
 *
 * Функция requireAuth подключается ко всем административным маршрутам,
 * поэтому ни одна служебная страница не доступна без входа в систему.
 */
'use strict';

const logService = require('../services/logService');

/**
 * Формирует описание инициатора действия для записи в журнал.
 * Используется во всех маршрутах приложения.
 */
function buildActor(req) {
  if (req.session && req.session.admin) {
    return {
      type: 'admin',
      login: req.session.admin.login,
      ip: req.ip,
    };
  }
  return { type: 'guest', login: null, ip: req.ip };
}

/**
 * Пропускает дальше только администратора, вошедшего в систему.
 * Неавторизованный посетитель перенаправляется на страницу входа,
 * а попытка доступа фиксируется в журнале.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }

  logService.log('ACCESS_DENIED', {
    actor: buildActor(req),
    details: { reason: 'Обращение к административной странице без входа', path: req.originalUrl },
  });

  // Адрес запрошенной страницы сохраняется, чтобы вернуться на неё после входа
  req.session.returnTo = req.originalUrl;
  return res.redirect('/admin/login');
}

/**
 * Не пускает уже вошедшего администратора на страницу входа:
 * вместо формы он сразу попадает в панель управления.
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.admin) {
    return res.redirect('/admin');
  }
  return next();
}

module.exports = {
  requireAuth,
  redirectIfAuthenticated,
  buildActor,
};
