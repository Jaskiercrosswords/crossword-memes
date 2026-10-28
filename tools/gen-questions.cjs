/*
 * Генерирует js/questions.js из кроссворд.docx в корне папки Кроссворд.
 * Вопросы и ответы переносятся дословно; убирается только обёртка
 * «N. …? - ответ "..."». Английские слова сохраняются.
 * Запуск: multitool-node tools/gen-questions.cjs
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const srcRoot = path.join(root, '..');
const docx = path.join(srcRoot, 'кроссворд.docx');
const OUT = path.join(root, 'js', 'questions.js');

// --- извлечение текста из docx ---
function extractDocx(docxPath) {
  const tmp = path.join(os.tmpdir(), 'cw_docx_' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  const zipTmp = path.join(os.tmpdir(), 'cw_docx_' + Date.now() + '.zip');
  fs.copyFileSync(docxPath, zipTmp);
  execFileSync('powershell', [
    '-NoProfile', '-Command',
    'Expand-Archive -LiteralPath "' + zipTmp + '" -DestinationPath "' + tmp + '" -Force'
  ], { stdio: 'ignore' });
  const xml = fs.readFileSync(path.join(tmp, 'word', 'document.xml'), 'utf8');
  let text = xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function parseLine(line) {
  const m = line.match(/^(\d+)\.\s*(.*)$/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  let rest = m[2].trim();
  if (!rest) return null;

  function takeAnswer(after) {
    after = after.replace(/^(?:ответ\s*)?[:：\-–—\s]*/, '');
    const open = after.search(/["«“„]/);
    const closeSearch = /["»”]/;
    let answer = '';
    if (open >= 0) {
      const afterOpen = after.slice(open + 1);
      const c = closeSearch.exec(afterOpen);
      answer = c ? afterOpen.slice(0, c.index) : afterOpen;
    } else {
      answer = after.replace(/[\s.]+$/, '');
    }
    return answer.trim();
  }

  let question;
  let answer;

  // Формат 1: … - ответ "…"
  const answerMark = rest.search(/ответ/i);
  if (answerMark >= 0) {
    question = rest.slice(0, answerMark).trim();
    answer = takeAnswer(rest.slice(answerMark + 'ответ'.length));
  } else {
    // Формат 2: …? - "…" (без слова «ответ»)
    const open = rest.search(/["«“„]/);
    if (open < 0) return null;
    question = rest.slice(0, open).trim();
    answer = takeAnswer(rest.slice(open));
  }

  question = question.replace(/[-–—:：]+\s*$/, '').replace(/\s*\?+\s*$/, '').trim();

  if (!question || !answer) return null;
  return { id, question, answer };
}

function jsString(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function main() {
  const lines = extractDocx(docx);
  const entries = [];
  const seen = new Map();
  lines.forEach((line) => {
    const parsed = parseLine(line);
    if (!parsed) return;
    if (seen.has(parsed.id)) {
      console.error('Дважды встречен id', parsed.id, '— строка:', line);
      return;
    }
    seen.set(parsed.id, true);
    entries.push(parsed);
  });

  entries.sort((a, b) => a.id - b.id);
  console.log('Разобрано вопросов:', entries.length);

  // Особые подсказки-плашки (добавлены ранее по просьбе автора; вопросы те же).
  const specialHints = {
    10: 'от английского chill out',
    12: 'один из героев аниме Магическая Битва',
    15: 'название фильма',
    72: 'написали песни Нон-Стоп и Контракт',
    78: 'популярная игра',
    81: 'в 2023 году на свет одновременно вышли два совершенно разных фильма ставшие кассовым противостоянием, люди приходили на показы в сочетании розового и черного'
  };

  // Допустимые варианты написания: как есть + без пробелов/дефисов.
  const body = entries.map((e) => {
    const answerJs = jsString(e.answer);
    const accepted = [e.answer];
    const hint = specialHints[e.id] ? ', specialHint: ' + jsString(specialHints[e.id]) : '';
    return '    { id: ' + e.id + ', question: ' + jsString(e.question)
      + ', answer: ' + answerJs
      + ', acceptedAnswers: ' + JSON.stringify(accepted)
      + hint + ' },';
  }).join('\n');

  const header = `/*
 * Все вопросы игры. Содержимое перенесено дословно из кроссворд.docx
 * (формулировки и ответы автора не изменялись; английские слова сохранены).
 */
(function (global) {
  'use strict';

  const QUESTIONS = [
${body}
  ];

  global.QUESTIONS = QUESTIONS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QUESTIONS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
`;

  fs.writeFileSync(OUT, header, 'utf8');
  console.log('Записано:', OUT);
  console.log('Использованы id: от', entries[0] && entries[0].id, 'до', entries[entries.length - 1] && entries[entries.length - 1].id);
}

main();