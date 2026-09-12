/**
 * Первичное наполнение базы данных демонстрационными данными.
 * Запуск: npm run seed
 * Повторный запуск безопасен — существующие записи не дублируются.
 */
'use strict';

const bcrypt = require('bcryptjs');
const db = require('./database');
const config = require('../config');

// --- Темы каталога ---
const topics = [
  { name: 'Разработка',   slug: 'development',   description: 'Языки программирования, фреймворки и инструменты разработчика' },
  { name: 'Дизайн',       slug: 'design',        description: 'Интерфейсы, типографика, цвет и графические редакторы' },
  { name: 'Обучение',     slug: 'education',     description: 'Курсы, интерактивные тренажёры и учебные материалы' },
  { name: 'Инструменты',  slug: 'tools',         description: 'Онлайн-сервисы, помогающие в повседневной работе' },
  { name: 'Документация', slug: 'documentation', description: 'Официальные справочники, спецификации и стандарты' },
  { name: 'Сообщества',   slug: 'communities',   description: 'Форумы, площадки вопросов и ответов, профессиональные сети' },
];

// --- Ссылки каталога (поле topic содержит slug темы) ---
const links = [
  // Разработка
  { title: 'MDN Web Docs',        url: 'https://developer.mozilla.org',   topic: 'development',   description: 'Наиболее полный справочник по HTML, CSS и JavaScript от Mozilla.', clicks: 247 },
  { title: 'Node.js',             url: 'https://nodejs.org',              topic: 'development',   description: 'Серверная платформа для выполнения JavaScript вне браузера.', clicks: 189 },
  { title: 'Express',             url: 'https://expressjs.com',           topic: 'development',   description: 'Минималистичный веб-фреймворк для Node.js.', clicks: 156 },
  { title: 'Vite',                url: 'https://vitejs.dev',              topic: 'development',   description: 'Быстрый сборщик проектов нового поколения.', clicks: 134 },
  { title: 'TypeScript',          url: 'https://www.typescriptlang.org',  topic: 'development',   description: 'Язык со статической типизацией, расширяющий JavaScript.', clicks: 201 },
  { title: 'SQLite',              url: 'https://www.sqlite.org',          topic: 'development',   description: 'Встраиваемая реляционная СУБД, хранящая базу в одном файле.', clicks: 98 },
  { title: 'Vue.js',              url: 'https://vuejs.org',               topic: 'development',   description: 'Прогрессивный фреймворк для построения пользовательских интерфейсов.', clicks: 145 },
  { title: 'Can I use',           url: 'https://caniuse.com',             topic: 'development',   description: 'Таблицы поддержки веб-технологий браузерами.', clicks: 176 },

  // Дизайн
  { title: 'Figma',               url: 'https://www.figma.com',           topic: 'design',        description: 'Онлайн-редактор интерфейсов с совместной работой в реальном времени.', clicks: 312 },
  { title: 'Coolors',             url: 'https://coolors.co',              topic: 'design',        description: 'Генератор цветовых палитр с проверкой контраста.', clicks: 143 },
  { title: 'Google Fonts',        url: 'https://fonts.google.com',        topic: 'design',        description: 'Библиотека бесплатных шрифтов для веб-проектов.', clicks: 198 },
  { title: 'Material Design',     url: 'https://m3.material.io',          topic: 'design',        description: 'Дизайн-система Google с подробными рекомендациями.', clicks: 121 },
  { title: 'Type Scale',          url: 'https://typescale.com',           topic: 'design',        description: 'Инструмент подбора гармоничной типографической шкалы.', clicks: 67 },
  { title: 'unDraw',              url: 'https://undraw.co',               topic: 'design',        description: 'Коллекция бесплатных иллюстраций с настраиваемым цветом.', clicks: 89 },
  { title: 'Apple HIG',           url: 'https://developer.apple.com/design/human-interface-guidelines', topic: 'design', description: 'Руководство Apple по проектированию интерфейсов.', clicks: 76 },

  // Обучение
  { title: 'freeCodeCamp',        url: 'https://www.freecodecamp.org',    topic: 'education',     description: 'Бесплатная платформа с практическими курсами по веб-разработке.', clicks: 265 },
  { title: 'Современный учебник JavaScript', url: 'https://learn.javascript.ru', topic: 'education', description: 'Подробный учебник по JavaScript на русском языке.', clicks: 334 },
  { title: 'Codewars',            url: 'https://www.codewars.com',        topic: 'education',     description: 'Тренажёр по программированию в формате задач-ката.', clicks: 152 },
  { title: 'CSS-Tricks',          url: 'https://css-tricks.com',          topic: 'education',     description: 'Статьи и приёмы вёрстки от практикующих разработчиков.', clicks: 187 },
  { title: 'Flexbox Froggy',      url: 'https://flexboxfroggy.com',       topic: 'education',     description: 'Игровой тренажёр для изучения CSS Flexbox.', clicks: 94 },
  { title: 'Grid Garden',         url: 'https://cssgridgarden.com',       topic: 'education',     description: 'Интерактивная игра для освоения CSS Grid.', clicks: 81 },
  { title: 'Хекслет',             url: 'https://ru.hexlet.io',            topic: 'education',     description: 'Онлайн-курсы по программированию на русском языке.', clicks: 118 },

  // Инструменты
  { title: 'GitHub',              url: 'https://github.com',              topic: 'tools',         description: 'Хостинг репозиториев Git и площадка совместной разработки.', clicks: 421 },
  { title: 'Postman',             url: 'https://www.postman.com',         topic: 'tools',         description: 'Приложение для тестирования и документирования API.', clicks: 167 },
  { title: 'Regex101',            url: 'https://regex101.com',            topic: 'tools',         description: 'Отладчик регулярных выражений с пояснениями.', clicks: 203 },
  { title: 'JSON Formatter',      url: 'https://jsonformatter.org',       topic: 'tools',         description: 'Форматирование и проверка корректности JSON.', clicks: 129 },
  { title: 'Squoosh',             url: 'https://squoosh.app',             topic: 'tools',         description: 'Сжатие изображений в браузере с наглядным сравнением.', clicks: 104 },
  { title: 'PageSpeed Insights',  url: 'https://pagespeed.web.dev',       topic: 'tools',         description: 'Анализ скорости загрузки страниц от Google.', clicks: 138 },
  { title: 'Excalidraw',          url: 'https://excalidraw.com',          topic: 'tools',         description: 'Онлайн-доска для схем в стиле рисунка от руки.', clicks: 156 },
  { title: 'DevDocs',             url: 'https://devdocs.io',              topic: 'tools',         description: 'Документация множества технологий в едином интерфейсе.', clicks: 112 },

  // Документация
  { title: 'Стандарты W3C',       url: 'https://www.w3.org/TR',           topic: 'documentation', description: 'Официальные спецификации веб-стандартов.', clicks: 87 },
  { title: 'HTML Living Standard',url: 'https://html.spec.whatwg.org',    topic: 'documentation', description: 'Действующая спецификация HTML от WHATWG.', clicks: 73 },
  { title: 'RFC Editor',          url: 'https://www.rfc-editor.org',      topic: 'documentation', description: 'Архив документов RFC, описывающих интернет-протоколы.', clicks: 54 },
  { title: 'EJS',                 url: 'https://ejs.co',                  topic: 'documentation', description: 'Документация шаблонизатора EJS.', clicks: 91 },
  { title: 'Web.dev',             url: 'https://web.dev',                 topic: 'documentation', description: 'Руководства Google по современной веб-разработке.', clicks: 145 },
  { title: 'HTTP Status Cats',    url: 'https://http.cat',                topic: 'documentation', description: 'Наглядный справочник кодов состояния HTTP.', clicks: 68 },

  // Сообщества
  { title: 'Stack Overflow',      url: 'https://stackoverflow.com',       topic: 'communities',   description: 'Крупнейшая площадка вопросов и ответов для программистов.', clicks: 389 },
  { title: 'Хабр',                url: 'https://habr.com',                topic: 'communities',   description: 'Русскоязычное сообщество ИТ-специалистов.', clicks: 276 },
  { title: 'Dev.to',              url: 'https://dev.to',                  topic: 'communities',   description: 'Международное сообщество разработчиков и блог-платформа.', clicks: 164 },
  { title: 'Reddit r/webdev',     url: 'https://www.reddit.com/r/webdev', topic: 'communities',   description: 'Раздел Reddit, посвящённый веб-разработке.', clicks: 132 },
  { title: 'Хабр Q&A',            url: 'https://qna.habr.com',            topic: 'communities',   description: 'Сервис вопросов и ответов на русском языке.', clicks: 97 },

  // Скрытые записи — нужны для демонстрации ЛБ 3 (просмотр скрытых ссылок)
  { title: 'Устаревший ресурс (архив)', url: 'https://example.com/outdated', topic: 'development', description: 'Материал снят с публикации: информация потеряла актуальность.', clicks: 12, hidden: true },
  { title: 'Черновик подборки',   url: 'https://example.com/draft',       topic: 'tools',         description: 'Подборка в процессе подготовки, ещё не опубликована.', clicks: 3, hidden: true },
];

/** Заполняет базу данных начальными данными. */
function seed() {
  // Все вставки выполняются одной транзакцией: при ошибке ничего не сохранится
  const run = db.transaction(() => {
    // --- Темы ---
    const insertTopic = db.prepare(
      'INSERT OR IGNORE INTO topics (name, slug, description) VALUES (?, ?, ?)'
    );
    for (const t of topics) insertTopic.run(t.name, t.slug, t.description);

    // Сопоставление slug темы с её идентификатором
    const topicIdBySlug = {};
    for (const row of db.prepare('SELECT id, slug FROM topics').all()) {
      topicIdBySlug[row.slug] = row.id;
    }

    // --- Ссылки ---
    const exists = db.prepare('SELECT id FROM links WHERE url = ?');
    const insertLink = db.prepare(`
      INSERT INTO links (title, url, description, topic_id, is_hidden, clicks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    let added = 0;
    for (const l of links) {
      if (exists.get(l.url)) continue; // запись уже есть — пропускаем
      insertLink.run(l.title, l.url, l.description, topicIdBySlug[l.topic], l.hidden ? 1 : 0, l.clicks);
      added++;
    }

    // --- Администратор по умолчанию (ЛБ 7) ---
    const adminExists = db.prepare('SELECT id FROM admins WHERE login = ?').get(config.admin.login);
    if (!adminExists) {
      const hash = bcrypt.hashSync(config.admin.password, 10);
      db.prepare('INSERT INTO admins (login, password_hash) VALUES (?, ?)')
        .run(config.admin.login, hash);
    }

    return added;
  });

  const added = run();
  const totalLinks = db.prepare('SELECT COUNT(*) AS c FROM links').get().c;
  const totalTopics = db.prepare('SELECT COUNT(*) AS c FROM topics').get().c;

  console.log('База данных заполнена.');
  console.log(`  Тем в каталоге:     ${totalTopics}`);
  console.log(`  Ссылок в каталоге:  ${totalLinks} (добавлено в этот раз: ${added})`);
  console.log(`  Администратор:      ${config.admin.login} / ${config.admin.password}`);
}

// Запуск только при прямом вызове файла, а не при импорте из другого модуля
if (require.main === module) seed();

module.exports = seed;
