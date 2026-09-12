/**
 * Поисковый каталог — точка входа приложения.
 *
 * Лабораторные работы по дисциплине «Основы веб-разработки», вариант 10.
 * Выполнила: Мальцева Е. М., группа 8ВМ61.
 *
 * Запуск:
 *   npm start        — обычный запуск
 *   npm run dev      — запуск с автоматической перезагрузкой при изменении файлов
 *   npm run debug    — запуск с отладчиком (ЛБ 8)
 */
'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const config = require('./config');
const logService = require('./services/logService');
const { attachLocals, flashHelper } = require('./middleware/locals');
const { buildActor } = require('./middleware/auth');

const catalogRoutes = require('./routes/catalogRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// --- Настройка шаблонизатора ------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Доверие к заголовкам обратного прокси: без этого req.ip показывает адрес прокси
app.set('trust proxy', true);

// --- Базовые обработчики ----------------------------------------------------

// Разбор данных, отправленных обычной HTML-формой
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Отдача статических файлов: таблицы стилей и сценариев
app.use(express.static(path.join(__dirname, 'public')));

// Хранение сессий в базе данных: после перезапуска сервера вход сохраняется (ЛБ 7)
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: config.paths.sessions }),
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                                        // cookie недоступна сценариям в браузере
    maxAge: config.session.maxAgeMinutes * 60 * 1000,
    sameSite: 'lax',                                       // защита от межсайтовых запросов
  },
}));

// Вспомогательные обработчики: общие переменные шаблонов и одноразовые сообщения
app.use(flashHelper);
app.use(attachLocals);

// --- Маршруты ---------------------------------------------------------------
app.use('/admin', adminRoutes);   // административная часть (ЛБ 3–7)
app.use('/', catalogRoutes);      // пользовательская часть (ЛБ 1–2)

// --- Обработка несуществующих адресов ---------------------------------------
app.use((req, res) => {
  res.status(404).render('pages/error', {
    title: 'Страница не найдена',
    status: 404,
    message: 'Запрошенной страницы не существует. Проверьте правильность адреса.',
  });
});

// --- Обработка ошибок сервера -----------------------------------------------
// Обработчик с четырьмя параметрами Express распознаёт как обработчик ошибок
app.use((error, req, res, next) => {
  console.error('[Ошибка сервера]', error);

  logService.log('SERVER_ERROR', {
    actor: buildActor(req),
    details: { path: req.originalUrl, message: error.message },
  });

  res.status(500).render('pages/error', {
    title: 'Ошибка сервера',
    status: 500,
    message: 'При обработке запроса произошла ошибка. Попробуйте повторить действие позже.',
    // Подробности выводятся только в режиме разработки (ЛБ 8)
    details: process.env.NODE_ENV === 'production' ? null : error.stack,
  });
});

// --- Запуск сервера ---------------------------------------------------------
const server = app.listen(config.port, () => {
  console.log('');
  console.log('  Поисковый каталог запущен');
  console.log(`  Адрес сайта:            http://localhost:${config.port}`);
  console.log(`  Административная часть: http://localhost:${config.port}/admin`);
  console.log(`  Учётная запись:         ${config.admin.login} / ${config.admin.password}`);
  console.log('');
  console.log('  Остановка сервера — сочетание клавиш Ctrl+C');
  console.log('');
});

// Корректное завершение работы по сигналу остановки
process.on('SIGINT', () => {
  console.log('\n  Остановка сервера…');
  server.close(() => process.exit(0));
});

module.exports = app;
