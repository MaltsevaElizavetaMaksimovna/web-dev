/**
 * Сервис аутентификации администратора (ЛБ 7 — парольная защита).
 *
 * Пароли хранятся в базе только в виде хеша, вычисленного алгоритмом bcrypt.
 * Даже при получении доступа к файлу базы восстановить исходный пароль нельзя.
 */
'use strict';

const bcrypt = require('bcryptjs');
const adminRepository = require('../repositories/adminRepository');
const validation = require('./validationService');
const logService = require('./logService');

// Защита от подбора пароля: учёт неудачных попыток по адресу клиента.
// После MAX_ATTEMPTS неудачных попыток вход блокируется на BLOCK_DURATION_MS.
const failedAttempts = new Map();
const MAX_ATTEMPTS = 5;            // допустимое число неудачных попыток подряд
const BLOCK_DURATION_MS = 60_000;  // длительность блокировки — одна минута

/**
 * Проверяет, заблокирован ли клиент из-за превышения числа попыток.
 * @returns {{blocked: boolean, secondsLeft: number}}
 */
function checkBlocked(ip) {
  const record = failedAttempts.get(ip);
  if (!record || record.count < MAX_ATTEMPTS) return { blocked: false, secondsLeft: 0 };

  const elapsed = Date.now() - record.lastAttempt;
  if (elapsed >= BLOCK_DURATION_MS) {
    failedAttempts.delete(ip); // срок блокировки истёк
    return { blocked: false, secondsLeft: 0 };
  }

  return {
    blocked: true,
    secondsLeft: Math.ceil((BLOCK_DURATION_MS - elapsed) / 1000),
  };
}

/** Увеличивает счётчик неудачных попыток входа для указанного клиента. */
function registerFailure(ip) {
  const record = failedAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedAttempts.set(ip, record);
}

/** Сбрасывает счётчик попыток после успешного входа. */
function resetFailures(ip) {
  failedAttempts.delete(ip);
}

/**
 * Выполняет вход администратора.
 *
 * @param {string} rawLogin - логин из формы
 * @param {string} rawPassword - пароль из формы
 * @param {string} ip - адрес клиента
 * @returns {{ok: boolean, admin?: object, errors?: string[]}}
 */
function login(rawLogin, rawPassword, ip) {
  // Проверка временной блокировки выполняется до обращения к базе
  const blockState = checkBlocked(ip);
  if (blockState.blocked) {
    const message = `Слишком много неудачных попыток. Повторите через ${blockState.secondsLeft} с.`;
    logService.log('ACCESS_DENIED', {
      actor: { type: 'guest', ip },
      details: { reason: 'Временная блокировка входа' },
    });
    return { ok: false, errors: [message] };
  }

  // Проверка корректности заполнения формы
  const check = validation.validateCredentials(rawLogin, rawPassword);
  if (!check.valid) {
    return { ok: false, errors: check.errors };
  }

  const { login: userLogin, password } = check.value;
  const admin = adminRepository.findByLogin(userLogin);

  // Единое сообщение об ошибке: по нему нельзя определить, существует ли логин
  const commonError = 'Неверный логин или пароль.';

  if (!admin) {
    registerFailure(ip);
    logService.log('ADMIN_LOGIN_FAIL', {
      actor: { type: 'guest', ip },
      details: { login: userLogin, reason: 'Учётная запись не найдена' },
    });
    return { ok: false, errors: [commonError] };
  }

  // Сравнение введённого пароля с сохранённым хешем
  const passwordMatches = bcrypt.compareSync(password, admin.password_hash);

  if (!passwordMatches) {
    registerFailure(ip);
    logService.log('ADMIN_LOGIN_FAIL', {
      actor: { type: 'guest', ip },
      details: { login: userLogin, reason: 'Неверный пароль' },
    });
    return { ok: false, errors: [commonError] };
  }

  // Вход выполнен успешно
  resetFailures(ip);
  adminRepository.updateLastLogin(admin.id);

  logService.log('ADMIN_LOGIN_SUCCESS', {
    actor: { type: 'admin', login: admin.login, ip },
  });

  return {
    ok: true,
    admin: { id: admin.id, login: admin.login },
  };
}

/** Записывает в журнал событие выхода из административной панели. */
function logout(actor) {
  logService.log('ADMIN_LOGOUT', { actor });
}

/** Вычисляет хеш пароля — используется при создании учётных записей. */
function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, 10);
}

module.exports = {
  login,
  logout,
  hashPassword,
  checkBlocked,
};
