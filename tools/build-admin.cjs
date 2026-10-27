/*
 * Собирает отдельный сайт-админку из файлов игры.
 * Запуск: multitool-node tools/build-admin.cjs
 * Результат: папка ../admin-site (отдельный репозиторий и сайт).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, '..', 'admin-site');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, data) {
  fs.writeFileSync(path.join(out, file), data, 'utf8');
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'js'), { recursive: true });

let html = read('index.html');

html = html.replace(
  '<title>Кроссворд: мемы и поп-культура</title>',
  '<title>Кроссворд — админка</title>'
);

html = html.replace(
  '<meta name="theme-color" content="#120f1d">',
  '<meta name="theme-color" content="#120f1d">\n  <meta name="robots" content="noindex, nofollow">'
);

html = html.replace(
  '<link rel="stylesheet" href="styles.css">',
  '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="admin.css">'
);

const bar = `<div class="admin-bar">
    <span class="admin-bar__label">Админка</span>
    <label class="admin-bar__field">
      Уровень
      <select id="admin-level"></select>
    </label>
    <button class="admin-bar__btn" id="admin-home" type="button">Главная</button>
    <button class="admin-bar__btn admin-bar__spacer" id="admin-reset" type="button">Сбросить прогресс</button>
  </div>

  `;

html = html.replace('<body>', '<body>\n  ' + bar);

html = html.replace(
  '<script src="js/main.js"></script>',
  '<script src="js/main.js"></script>\n  <script src="js/admin.js"></script>'
);

write('index.html', html);

fs.copyFileSync(path.join(root, 'styles.css'), path.join(out, 'styles.css'));
fs.copyFileSync(path.join(root, 'admin', 'admin.css'), path.join(out, 'admin.css'));
fs.copyFileSync(path.join(root, 'admin', 'admin.js'), path.join(out, 'js', 'admin.js'));

fs.readdirSync(path.join(root, 'js')).forEach(function (file) {
  if (!file.endsWith('.js')) return;
  fs.copyFileSync(path.join(root, 'js', file), path.join(out, 'js', file));
});

console.log('Админка собрана:', out);
console.log('Файлы:', fs.readdirSync(out).join(', '));
