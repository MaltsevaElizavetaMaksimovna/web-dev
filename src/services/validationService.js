/**
 * Сервис проверки исходных данных.
 *
 * Согласно требованиям к лабораторным работам проверка корректности
 * входных данных обязательна во всех задачах. Здесь собраны все правила,
 * чтобы одна и та же проверка не повторялась в разных частях приложения.
 *
 * Каждая функция возвращает объект вида
 *   { valid: boolean, value: <приведённое значение>, errors: string[] }
 */
'use strict';

const config = require('../config');

// Допустимые схемы адресов: посторонние схемы (например, javascript:) запрещены
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Убирает лишние пробелы и приводит значение к строке.
 * Защищает от передачи массивов и объектов в параметрах запроса.
 */
function toTrimmedString(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) value = value[0] ?? '';
  return String(value).trim();
}

/**
 * Экранирует символы, имеющие специальное значение в HTML.
 * Применяется как дополнительная защита от внедрения разметки.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Проверяет название ссылки. */
function validateTitle(raw) {
  const value = toTrimmedString(raw);
  const errors = [];

  if (!value) {
    errors.push('Название не может быть пустым.');
  } else if (value.length < 2) {
    errors.push('Название должно содержать не менее 2 символов.');
  } else if (value.length > config.validation.titleMaxLength) {
    errors.push(`Название не должно превышать ${config.validation.titleMaxLength} символов.`);
  }

  return { valid: errors.length === 0, value, errors };
}

/**
 * Проверяет адрес ссылки.
 * Разбор выполняется штатным классом URL, что надёжнее регулярных выражений.
 */
function validateUrl(raw) {
  let value = toTrimmedString(raw);
  const errors = [];

  if (!value) {
    return { valid: false, value, errors: ['Адрес ссылки не может быть пустым.'] };
  }

  if (value.length > config.validation.urlMaxLength) {
    errors.push(`Адрес не должен превышать ${config.validation.urlMaxLength} символов.`);
    return { valid: false, value, errors };
  }

  // Если пользователь не указал схему, подставляем https
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    value = `https://${value}`;
  }

  try {
    const parsed = new URL(value);

    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      errors.push('Допустимы только адреса, начинающиеся с http:// или https://');
    }

    // У адреса должно быть доменное имя с точкой либо имя localhost
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      errors.push('Адрес должен содержать корректное доменное имя.');
    }

    value = parsed.href;
  } catch {
    errors.push('Адрес имеет неверный формат.');
  }

  return { valid: errors.length === 0, value, errors };
}

/** Проверяет описание ссылки. Пустое описание допускается. */
function validateDescription(raw) {
  const value = toTrimmedString(raw);
  const errors = [];

  if (value.length > config.validation.descriptionMaxLength) {
    errors.push(`Описание не должно превышать ${config.validation.descriptionMaxLength} символов.`);
  }

  return { valid: errors.length === 0, value, errors };
}

/**
 * Проверяет идентификатор темы.
 * @param {*} raw - значение из формы или строки запроса
 * @param {function} existsFn - функция проверки существования темы в базе
 */
function validateTopicId(raw, existsFn) {
  const value = Number(toTrimmedString(raw));
  const errors = [];

  if (!Number.isInteger(value) || value <= 0) {
    errors.push('Тема выбрана некорректно.');
  } else if (typeof existsFn === 'function' && !existsFn(value)) {
    errors.push('Выбранной темы не существует.');
  }

  return { valid: errors.length === 0, value, errors };
}

/**
 * Проверяет числовой идентификатор записи из адреса страницы.
 * @returns {{valid: boolean, value: number}}
 */
function validateId(raw) {
  const value = Number(toTrimmedString(raw));
  const valid = Number.isInteger(value) && value > 0;
  return { valid, value, errors: valid ? [] : ['Некорректный идентификатор записи.'] };
}

/**
 * Приводит номер страницы к допустимому диапазону.
 * Некорректные значения заменяются первой страницей.
 */
function normalizePage(raw, totalPages = 1) {
  const value = Number(toTrimmedString(raw));
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, Math.max(1, totalPages));
}

/** Проверяет и ограничивает длину поисковой строки. */
function normalizeSearch(raw) {
  const value = toTrimmedString(raw);
  return value.slice(0, config.validation.searchMaxLength);
}

/** Проверяет режим сортировки, возвращая безопасное значение по умолчанию. */
function normalizeSort(raw) {
  const allowed = ['new', 'old', 'popular', 'title'];
  const value = toTrimmedString(raw);
  return allowed.includes(value) ? value : 'new';
}

/** Проверяет данные формы входа администратора (ЛБ 7). */
function validateCredentials(rawLogin, rawPassword) {
  const login = toTrimmedString(rawLogin);
  const password = toTrimmedString(rawPassword);
  const errors = [];

  if (!login) errors.push('Введите логин.');
  else if (login.length > 50) errors.push('Логин не должен превышать 50 символов.');

  if (!password) errors.push('Введите пароль.');
  else if (password.length > 100) errors.push('Пароль не должен превышать 100 символов.');

  return { valid: errors.length === 0, value: { login, password }, errors };
}

/**
 * Комплексная проверка формы ссылки (ЛБ 4).
 * Собирает результаты всех проверок в единый объект.
 *
 * @param {object} body - данные формы
 * @param {function} topicExistsFn - функция проверки существования темы
 * @returns {{valid: boolean, data: object, errors: string[]}}
 */
function validateLinkForm(body, topicExistsFn) {
  const title = validateTitle(body.title);
  const url = validateUrl(body.url);
  const description = validateDescription(body.description);
  const topicId = validateTopicId(body.topicId, topicExistsFn);

  const errors = [
    ...title.errors,
    ...url.errors,
    ...description.errors,
    ...topicId.errors,
  ];

  return {
    valid: errors.length === 0,
    data: {
      title: title.value,
      url: url.value,
      description: description.value,
      topicId: topicId.value,
      // Флажок формы приходит строкой 'on' либо отсутствует
      isHidden: body.isHidden === 'on' || body.isHidden === '1' || body.isHidden === true,
    },
    errors,
  };
}

module.exports = {
  toTrimmedString,
  escapeHtml,
  validateTitle,
  validateUrl,
  validateDescription,
  validateTopicId,
  validateId,
  normalizePage,
  normalizeSearch,
  normalizeSort,
  validateCredentials,
  validateLinkForm,
};
