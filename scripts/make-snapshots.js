/**
 * Формирование отдельных папок для сдачи лабораторных работ.
 *
 * Проект разрабатывался как единое приложение, поскольку работы 6, 7 и 8
 * дополняют страницы, созданные в работах 1–5, и отдельно от них не существуют.
 * Если работы принимаются отдельными папками, этот сценарий создаёт копии
 * проекта — по одной на каждую работу.
 *
 * Запуск: node scripts/make-snapshots.js
 * Результат: папка «Сдача» рядом с проектом, внутри — восемь папок.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, '..', 'Сдача');

// Данные для имён папок согласно требованиям к отчётам: ГГГГ_ФИО_№№
const GROUP = '8ВМ61';
const STUDENT = 'Мальцева_ЕМ';

// Описание работ по варианту 10
const LABS = [
  { num: 1, title: 'Просмотр и переход по ссылкам' },
  { num: 2, title: 'Фильтрация ссылок по темам' },
  { num: 3, title: 'Просмотр каталога ссылок, включая скрытые' },
  { num: 4, title: 'Добавление и удаление ссылок' },
  { num: 5, title: 'Рейтинг ссылок' },
  { num: 6, title: 'Протоколирование действий пользователя' },
  { num: 7, title: 'Парольная защита административных страниц' },
  { num: 8, title: 'Демонстрация процесса отладки' },
];

// Папки и файлы, которые не копируются в папки сдачи
const SKIP = new Set([
  'node_modules', '.git', 'data', 'logs', 'scripts', '.dockerignore',
]);

/** Рекурсивно копирует содержимое папки. */
function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;

    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

/** Создаёт папки сдачи для всех лабораторных работ. */
function makeSnapshots() {
  // Прежний результат удаляется, чтобы не смешивать старые и новые файлы
  if (fs.existsSync(OUTPUT)) {
    fs.rmSync(OUTPUT, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT, { recursive: true });

  for (const lab of LABS) {
    const folderName = `${GROUP}_${STUDENT}_${String(lab.num).padStart(2, '0')}`;
    const target = path.join(OUTPUT, folderName);

    copyDir(ROOT, target);

    // Пустые папки для базы данных и журналов создаются заново
    fs.mkdirSync(path.join(target, 'data'), { recursive: true });
    fs.mkdirSync(path.join(target, 'logs'), { recursive: true });

    // Краткое описание работы кладётся в корень папки
    const readme = [
      `# Лабораторная работа № ${lab.num}`,
      '',
      `**Тема:** ${lab.title}`,
      '',
      'Дисциплина: основы веб-разработки. Вариант 10 — «Поисковый каталог».',
      '',
      `Выполнила: Мальцева Елизавета Максимовна, группа ${GROUP}.`,
      '',
      '## Запуск',
      '',
      '```bash',
      'npm install',
      'npm run seed',
      'npm start',
      '```',
      '',
      'После запуска сайт доступен по адресу http://localhost:3000',
      '',
      'Учётная запись администратора: `admin` / `admin123`',
      '',
      'Подробное описание проекта приведено в файле README.md.',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(target, 'ЛАБОРАТОРНАЯ_РАБОТА.md'), readme, 'utf8');

    console.log(`  Создана папка: ${folderName}`);
  }

  console.log('');
  console.log(`Готово. Папки сдачи находятся здесь: ${OUTPUT}`);
  console.log('В каждой папке перед запуском необходимо выполнить npm install.');
}

makeSnapshots();
