/**
 * Сценарий пользовательской страницы каталога.
 *
 * Добавляет удобства при работе с фильтрами. Вся обработка данных
 * выполняется на сервере: без этого сценария страница остаётся полностью
 * работоспособной, форма отправляется обычным способом.
 */
'use strict';

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('filter-form');
  if (!form) return;

  var searchInput = document.getElementById('search');
  var sortSelect = document.getElementById('sort');

  // Изменение порядка вывода сразу применяет фильтр
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      form.submit();
    });
  }

  if (searchInput) {
    var timer = null;

    // Отправка формы через небольшую паузу после окончания ввода:
    // это исключает запрос к серверу на каждое нажатие клавиши
    searchInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        form.submit();
      }, 600);
    });

    // Клавиша Escape очищает поле поиска и возвращает полный список
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && searchInput.value) {
        clearTimeout(timer);
        searchInput.value = '';
        form.submit();
      }
    });

    // Курсор устанавливается в конец строки, если поиск уже выполнялся
    if (searchInput.value) {
      var value = searchInput.value;
      searchInput.focus();
      searchInput.setSelectionRange(value.length, value.length);
    }
  }
});
