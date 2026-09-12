/**
 * Промежуточные обработчики общего назначения.
 */
'use strict';

/**
 * Передаёт в шаблоны значения, нужные почти на каждой странице:
 * сведения о текущем администраторе, адрес запроса и текущий год.
 * Благодаря этому не нужно указывать их в каждом вызове res.render.
 */
function attachLocals(req, res, next) {
  res.locals.currentAdmin = (req.session && req.session.admin) || null;
  res.locals.currentPath = req.path;
  res.locals.currentYear = new Date().getFullYear();

  // Одноразовые сообщения (успех или ошибка) показываются один раз
  // после перенаправления, затем удаляются из сессии.
  if (req.session) {
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
  } else {
    res.locals.flash = null;
  }

  next();
}

/**
 * Сохраняет одноразовое сообщение в сессии.
 * Добавляется к объекту запроса, чтобы маршруты могли вызывать req.setFlash().
 */
function flashHelper(req, res, next) {
  req.setFlash = (type, message) => {
    if (req.session) {
      req.session.flash = { type, message };
    }
  };
  next();
}

module.exports = {
  attachLocals,
  flashHelper,
};
