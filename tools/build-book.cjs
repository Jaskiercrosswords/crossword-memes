/*
 * Собирает печатный HTML-документ: все вопросы, готовые сетки по уровням
 * и ответы. Запуск:
 *   multitool-node tools/build-book.cjs
 * Результат: ../кроссворд-вопросы-и-сетки.html
 */
'use strict';

const fs = require('fs');
const path = require('path');

const C = require('../js/crossword.js');
const questions = require('../js/questions.js');

const OUT = path.join(__dirname, '..', '..', 'кроссворд-вопросы-и-сетки.html');

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pluralLetters(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'буква';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'буквы';
  return 'букв';
}

function pluralQuestions(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'вопрос';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'вопроса';
  return 'вопросов';
}

const DIFFICULTY = { easy: 'простое', medium: 'среднее', hard: 'сложное' };

const levels = C.buildLevels(questions);
const prepared = levels.map(function (level) {
  return C.prepareLevel(level);
});

const questionById = new Map();
questions.forEach(function (item) {
  questionById.set(item.id, item);
});

function renderGrid(board, answers) {
  const rows = [];
  for (let row = 0; row < board.height; row += 1) {
    const cells = [];
    for (let col = 0; col < board.width; col += 1) {
      const cell = board.cells.get(C.cellKey(row, col));
      if (!cell) {
        cells.push('<td class="void"></td>');
        continue;
      }
      const classes = ['cell'];
      if (answers) classes.push('cell--answer');
      const label = cell.numbers.length
        ? '<span class="cell__num">' + cell.numbers[0] + '</span>'
        : '';
      const letter = answers ? '<span class="cell__letter">' + esc(cell.letter) + '</span>' : '';
      cells.push('<td class="' + classes.join(' ') + '">' + label + letter + '</td>');
    }
    rows.push('<tr>' + cells.join('') + '</tr>');
  }
  return '<table class="grid" style="--cols:' + board.width + '">' + rows.join('') + '</table>';
}

function renderClues(words) {
  const across = words.filter(function (word) { return word.horizontal; })
    .sort(function (a, b) { return a.number - b.number; });
  const down = words.filter(function (word) { return !word.horizontal; })
    .sort(function (a, b) { return a.number - b.number; });

  function list(items) {
    if (!items.length) return '<p class="clues__empty">Нет слов.</p>';
    return '<ol class="clues__list">' + items.map(function (word) {
      const question = questionById.get(word.id);
      return '<li><b>' + word.number + '.</b> ' + esc(question.question)
        + ' <span class="clues__len">(' + word.cells.length + ' '
        + pluralLetters(word.cells.length) + ')</span></li>';
    }).join('') + '</ol>';
  }

  return '<div class="clues">'
    + '<div class="clues__col"><h3 class="clues__title">По горизонтали</h3>' + list(across) + '</div>'
    + '<div class="clues__col"><h3 class="clues__title">По вертикали</h3>' + list(down) + '</div>'
    + '</div>';
}

function renderExtras(level) {
  if (!level.extraIds.length) return '';

  const items = level.extraIds.slice().sort(function (a, b) { return a - b; }).map(function (id) {
    const question = questionById.get(id);
    const letters = C.getGridText(question).length;
    return '<li><b>' + esc(question.answer) + '</b> — ' + esc(question.question)
      + ' <span class="clues__len">(' + letters + ' ' + pluralLetters(letters) + ')</span></li>';
  });

  return '<div class="extra"><h3 class="clues__title">Дополнительные слова (вне сетки)</h3>'
    + '<p class="extra__hint">Эти ответы не помещаются в сетку и вписываются отдельно.</p>'
    + '<ol class="clues__list">' + items.join('') + '</ol></div>';
}

function renderLevel(level, index) {
  const board = level.board;
  const words = board.words.slice().sort(function (a, b) {
    if (a.number !== b.number) return a.number - b.number;
    return a.horizontal === b.horizontal ? 0 : (a.horizontal ? -1 : 1);
  });

  return '<section class="level">'
    + '<header class="level__head">'
    + '<p class="level__eyebrow">Уровень ' + (index + 1) + '</p>'
    + '<h2 class="level__title">' + esc(level.title) + '</h2>'
    + '<p class="level__meta">' + level.questions.length + ' слов'
    + (level.extraIds.length ? ' · ' + level.extraIds.length + ' вне сетки' : '')
    + ' · сетка ' + board.width + '×' + board.height + '</p>'
    + '</header>'
    + '<div class="grid-wrap">' + renderGrid(board, false) + '</div>'
    + renderClues(words)
    + renderExtras(level)
    + '</section>';
}

function renderAnswers(level, index) {
  const words = level.board.words.slice().sort(function (a, b) {
    if (a.number !== b.number) return a.number - b.number;
    return a.horizontal === b.horizontal ? 0 : (a.horizontal ? -1 : 1);
  });

  const list = words.map(function (word) {
    const question = questionById.get(word.id);
    return '<li><b>' + word.number + (word.horizontal ? ' →' : ' ↓') + '</b> '
      + esc(question.answer) + '</li>';
  });

  const extras = level.extraIds.slice().sort(function (a, b) { return a - b; }).map(function (id) {
    const question = questionById.get(id);
    return '<li><b>доп.</b> ' + esc(question.answer) + '</li>';
  });

  return '<section class="answer-level">'
    + '<h3 class="answer-level__title">Уровень ' + (index + 1) + '. ' + esc(level.title) + '</h3>'
    + '<div class="answer-level__body">'
    + '<div class="answer-level__grid">' + renderGrid(level.board, true) + '</div>'
    + '<ol class="answer-level__list">' + list.join('') + extras.join('') + '</ol>'
    + '</div></section>';
}

function renderAppendix() {
  const rows = questions.slice().sort(function (a, b) { return a.id - b.id; }).map(function (item) {
    const levelIndex = prepared.findIndex(function (level) {
      return level.questions.some(function (question) { return question.id === item.id; });
    });
    return '<tr>'
      + '<td class="num">' + item.id + '</td>'
      + '<td>' + esc(item.question) + '</td>'
      + '<td><b>' + esc(item.answer) + '</b></td>'
      + '<td class="num">' + (levelIndex + 1) + '</td>'
      + '</tr>';
  });

  return '<section class="appendix">'
    + '<h2 class="section-title">Все ' + questions.length + ' вопросов и ответов</h2>'
    + '<table class="table">'
    + '<thead><tr><th>№</th><th>Вопрос</th><th>Ответ</th><th>Ур.</th></tr></thead>'
    + '<tbody>' + rows.join('') + '</tbody>'
    + '</table></section>';
}

const totalWords = prepared.reduce(function (sum, level) { return sum + level.questions.length + level.extraIds.length; }, 0);

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Кроссворд: мемы и поп-культура — вопросы, сетки, ответы</title>
<style>
  :root {
    --ink: #1c1830;
    --muted: #6b6485;
    --line: #cfc9e2;
    --accent: #6d4bd8;
    --soft: #f4f1fb;
    --font: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 32px 20px 64px;
    background: #f7f5fc;
    color: var(--ink);
    font-family: var(--font);
    font-size: 15px;
    line-height: 1.45;
  }

  .page {
    max-width: 960px;
    margin: 0 auto;
  }

  .doc-head {
    padding: 28px 30px;
    border-radius: 18px;
    background: linear-gradient(135deg, #2a2145, #1a1530);
    color: #f4f0ff;
  }

  .doc-head h1 {
    margin: 0 0 8px;
    font-size: 30px;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .doc-head p { margin: 0; color: #c8bde8; }
  .doc-head .eyebrow {
    margin: 0 0 8px;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8ee8d4;
  }

  .doc-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.16);
  }

  .doc-stats span { color: #ded6f4; font-size: 13px; }
  .doc-stats b { color: #fff; }

  .rules {
    margin: 22px 0 0;
    padding: 16px 20px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid var(--line);
  }

  .rules h2 {
    margin: 0 0 8px;
    font-size: 15px;
  }

  .rules ul {
    margin: 0;
    padding-left: 18px;
    color: #3b3552;
    font-size: 13.5px;
  }

  .rules li + li { margin-top: 4px; }

  .level {
    margin-top: 28px;
    padding: 24px 26px 26px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 18px;
  }

  .level__eyebrow {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .level__title {
    margin: 0 0 4px;
    font-size: 22px;
    letter-spacing: -0.02em;
  }

  .level__meta {
    margin: 0;
    font-size: 12.5px;
    color: var(--muted);
  }

  .grid-wrap {
    display: flex;
    justify-content: center;
    margin: 18px 0 6px;
    overflow-x: auto;
  }

  .grid {
    border-collapse: collapse;
    table-layout: fixed;
  }

  .grid td {
    width: 26px;
    height: 26px;
    padding: 0;
    text-align: center;
    vertical-align: middle;
  }

  .grid td.cell {
    position: relative;
    border: 1px solid #4a4370;
    background: #fbfaff;
  }

  .grid td.void {
    border: 0;
    background: transparent;
  }

  .cell__num {
    position: absolute;
    top: 1px;
    left: 2px;
    font-size: 8px;
    line-height: 1;
    color: var(--muted);
    font-weight: 600;
  }

  .cell__letter {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    color: #4b2fb0;
  }

  .grid td.cell--answer { background: #f5f1ff; }

  .clues {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px 30px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }

  .clues__title {
    margin: 0 0 8px;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .clues__list {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13.5px;
  }

  .clues__list li {
    padding: 3px 0 3px 0;
    break-inside: avoid;
  }

  .clues__list b { color: var(--accent); }

  .clues__len {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }

  .extra {
    margin-top: 18px;
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--soft);
    border: 1px dashed #c4b9ea;
  }

  .extra__hint {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--muted);
  }

  .section-title {
    margin: 40px 0 14px;
    font-size: 22px;
    letter-spacing: -0.02em;
  }

  .answers {
    margin-top: 34px;
    padding: 24px 26px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 18px;
  }

  .answers h2 {
    margin: 0 0 6px;
    font-size: 22px;
    letter-spacing: -0.02em;
  }

  .answers__hint {
    margin: 0 0 8px;
    font-size: 12.5px;
    color: var(--muted);
  }

  .answer-level {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    break-inside: avoid;
  }

  .answer-level__title {
    margin: 0 0 10px;
    font-size: 15px;
  }

  .answer-level__body {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    align-items: flex-start;
  }

  .answer-level__grid .grid td { width: 22px; height: 22px; }
  .answer-level__grid .cell__letter { font-size: 11px; }
  .answer-level__grid .cell__num { font-size: 7px; }

  .answer-level__list {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    columns: 2;
    column-gap: 24px;
    flex: 1;
    min-width: 220px;
  }

  .appendix { margin-top: 34px; }

  .table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    font-size: 12.5px;
  }

  .table th {
    text-align: left;
    padding: 8px 10px;
    background: var(--soft);
    border-bottom: 1px solid var(--line);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .table td {
    padding: 7px 10px;
    border-bottom: 1px solid #ece7f7;
    vertical-align: top;
  }

  .table tr:last-child td { border-bottom: 0; }
  .table .num { text-align: center; color: var(--muted); white-space: nowrap; }

  .doc-foot {
    margin-top: 30px;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }

  @media print {
    @page { size: A4; margin: 14mm; }

    body {
      padding: 0;
      background: #fff;
      font-size: 12px;
    }

    .page { max-width: none; }

    .doc-head {
      border-radius: 0;
      padding: 16px 18px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .rules, .level, .answers {
      border-radius: 0;
      border-color: #999;
    }

    .level { break-before: page; margin-top: 0; border: 0; padding: 0; }
    .level:first-of-type { break-before: auto; }

    .answers { break-before: page; border: 0; padding: 0; }
    .answer-level { break-inside: avoid; }

    .appendix { break-before: page; }

    .grid td { width: 22px; height: 22px; }
    .cell__letter { font-size: 12px; }

    .table { font-size: 10px; }
    .table th, .table td { padding: 4px 6px; }
  }

  @media (max-width: 640px) {
    body { padding: 18px 12px 40px; }
    .clues { grid-template-columns: 1fr; }
    .answer-level__list { columns: 1; }
    .doc-head h1 { font-size: 24px; }
    .level { padding: 18px 16px; }
    .grid td { width: 22px; height: 22px; }
  }
</style>
</head>
<body>
<div class="page">
  <header class="doc-head">
    <p class="eyebrow">Печатная версия</p>
    <h1>Кроссворд: мемы и поп-культура</h1>
    <p>Все вопросы, готовые сетки по уровням и ответы для проверки.</p>
    <div class="doc-stats">
      <span><b>${totalWords}</b> ${pluralQuestions(totalWords)}</span>
      <span><b>${prepared.length}</b> уровней</span>
      <span><b>${prepared.reduce(function (s, l) { return s + l.board.words.length; }, 0)}</b> слов в сетках</span>
      <span><b>${prepared.reduce(function (s, l) { return s + l.extraIds.length; }, 0)}</b> слов вне сеток</span>
    </div>
  </header>

  <section class="rules">
    <h2>Как читать документ</h2>
    <ul>
      <li>Сетка каждого уровня пронумерована: числа в левом верхнем углу клетки — номера слов.</li>
      <li>Списки «По горизонтали» и «По вертикали» дают вопрос и количество букв.</li>
      <li>Слова вне сетки вынесены в отдельный блок под сеткой.</li>
      <li>Регистр, пробелы, дефисы и разница между «ё» и «е» при проверке не важны.</li>
      <li>Ответы ко всем уровням — в разделе «Ответы» в конце документа.</li>
    </ul>
  </section>

  ${prepared.map(renderLevel).join('\n')}

  <section class="answers">
    <h2>Ответы</h2>
    <p class="answers__hint">Заполненные сетки и списки ответов по номерам: → по горизонтали, ↓ по вертикали.</p>
    ${prepared.map(renderAnswers).join('\n')}
  </section>

  <section class="appendix">
    ${renderAppendix()}
  </section>

  <p class="doc-foot">Документ создан автоматически из js/questions.js проекта modern-crossword.</p>
</div>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('Записано:', OUT);
console.log('Размер:', (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1), 'КБ');
console.log('Уровней:', prepared.length, '· вопросов:', totalWords);
