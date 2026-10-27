/* Админ-панель: выбор любого уровня и быстрый сброс прогресса. */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var app = window.GameApp;
    var select = document.getElementById('admin-level');
    var startScreen = document.getElementById('screen-start');
    var gameScreen = document.getElementById('screen-game');
    var sudokuScreen = document.getElementById('screen-sudoku');

    if (!app || !select) return;

    var titles = app.levelTitles();
    titles.forEach(function (title, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = title;
      select.appendChild(option);
    });

    select.addEventListener('change', function () {
      if (startScreen) startScreen.hidden = true;
      if (sudokuScreen) sudokuScreen.hidden = true;
      app.startLevel(Number(select.value));
    });

    var home = document.getElementById('admin-home');
    if (home) {
      home.addEventListener('click', function () {
        if (gameScreen) gameScreen.hidden = true;
        if (sudokuScreen) sudokuScreen.hidden = true;
        if (startScreen) startScreen.hidden = false;
      });
    }

    var reset = document.getElementById('admin-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        try {
          localStorage.removeItem('crossword.memes.v2');
        } catch (error) {
          /* приватный режим */
        }
        window.location.reload();
      });
    }

    // Админка сразу открывает первый уровень — так удобнее проверять.
    if (startScreen) startScreen.hidden = true;
    app.startLevel(0);
    select.value = '0';
  });
})();
