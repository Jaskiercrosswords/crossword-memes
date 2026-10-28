/*
 * Генерирует js/questions.js из кроссворд.docx в корне папки Кроссворд.
 * Вопросы и ответы переносятся дословно. Строки «Пояснение: …» привязываются
 * к предыдущему вопросу как поле explanation. Номера в тексте не являются
 * источником id: id присваивается по порядку появления (1..N).
 * Английские слова сохраняются.
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
  return text.split('\n').map((l) => l.replace(/^\uFEFF/, '').trim()).filter(Boolean);
}

function parseLine(line) {
  // Снимаем возможный порядковый номер в начале, но сохраняем «20.31» (время),
  // у которого после первой точки идёт ещё цифра с последующим текстом.
  let rest = line.trim();
  const numMatch = /^(\d+)\.\s*(.*)$/.exec(rest);
  if (numMatch && !/^\d/.test(numMatch[2])) {
    // e.g. «12. вопрос» — это номер; «20.31 прибыл» — время, оставляем как есть.
    rest = numMatch[2].trim();
  }
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

  question = question.replace(/[-–—:]+\s*$/, '').trim();

  if (!question || !answer) return null;
  return { question, answer };
}

function jsString(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function main() {
  const lines = extractDocx(docx);

  // Собираем последовательность «вопрос» и «пояснение».
  const entries = [];
  let current = null;
  lines.forEach((line) => {
    const explMatch = line.match(/^Пояснение\s*[:：]\s*(.*)/i);
    if (explMatch) {
      if (current) current.explanation = (current.explanation ? current.explanation + ' ' : '') + explMatch[1].trim();
      return;
    }
    const parsed = parseLine(line);
    if (!parsed) return;
    current = parsed;
    entries.push(current);
  });

  console.log('Разобрано вопросов:', entries.length);

  // Допустимые варианты написания: как есть.
  const body = entries.map((e, i) => {
    const id = i + 1;
    const answerJs = jsString(e.answer);
    const accepted = [e.answer];
    const expl = e.explanation ? ', explanation: ' + jsString(e.explanation) : '';
    return '    { id: ' + id + ', question: ' + jsString(e.question)
      + ', answer: ' + answerJs
      + ', acceptedAnswers: ' + JSON.stringify(accepted)
      + expl + ' },';
  }).join('\n');

  const header = `/*
 * Все вопросы игры. Содержимое перенесено дословно из кроссворд.docx
 * (формулировки и ответы автора не изменялись; английские слова сохранены).
 * Поле explanation содержит авторское пояснение (если есть).
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
}

main();