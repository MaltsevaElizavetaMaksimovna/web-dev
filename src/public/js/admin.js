/**
 * Сценарий административной панели.
 *
 * Отвечает за подтверждение необратимых действий и предварительную
 * проверку заполнения формы. Основная проверка данных выполняется
 * на сервере: сценарий лишь сокращает число заведомо ошибочных запросов.
 */
'use strict';

document.addEventListener('DOMContentLoaded', function () {

  /* --- Подтверждение удаления (ЛБ 4) -------------------------------------
     Формы с атрибутом data-confirm требуют подтверждения действия.
     ---------------------------------------------------------------------- */
  var confirmForms = document.querySelectorAll('form[data-confirm]');

  Array.prototype.forEach.call(confirmForms, function (form) {
    form.addEventListener('submit', function (event) {
      var message = form.getAttribute('data-confirm');
      if (!window.confirm(message)) {
        event.preventDefault(); // отправка формы отменяется
      }
    });
  });

  /* --- Счётчик оставшихся символов описания ------------------------------ */
  var description = document.getElementById('description');
  var counter = document.getElementById('description-counter');

  if (description && counter) {
    var maxLength = Number(description.getAttribute('maxlength')) || 500;

    var updateCounter = function () {
      var left = maxLength - description.value.length;
      counter.textContent = String(left);
      // При приближении к пределу счётчик выделяется цветом
      counter.style.color = left < 50 ? 'var(--danger)' : '';
    };

    description.addEventListener('input', updateCounter);
    updateCounter();
  }

  /* --- Предварительная проверка формы ссылки ----------------------------- */
  var linkForm = document.getElementById('link-form');

  if (linkForm) {
    linkForm.addEventListener('submit', function (event) {
      var title = document.getElementById('title');
      var url = document.getElementById('url');
      var topicId = document.getElementById('topicId');
      var problems = [];

      if (!title.value.trim()) {
        problems.push('Укажите название ссылки.');
      } else if (title.value.trim().length < 2) {
        problems.push('Название должно содержать не менее 2 символов.');
      }

      if (!url.value.trim()) {
        problems.push('Укажите адрес ресурса.');
      }

      if (!topicId.value) {
        problems.push('Выберите тему каталога.');
      }

      if (problems.length > 0) {
        event.preventDefault();
        window.alert('Проверьте заполнение формы:\n\n• ' + problems.join('\n• '));
      }
    });
  }
});
