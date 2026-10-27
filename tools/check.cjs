/* Проверка данных и генерации сеток. Запуск: multitool-node tools/check.cjs */
const path = require('path');
const questions = require(path.join(__dirname, '..', 'js', 'questions.js'));
const C = require(path.join(__dirname, '..', 'js', 'crossword.js'));

const validation = C.validateQuestions(questions);
console.log('== Валидация ==');
console.log('ok:', validation.ok);
console.log('ошибки:', validation.errors.length ? validation.errors : 'нет');
console.log('предупреждения:', validation.warnings.length ? validation.warnings : 'нет');

const levels = C.buildLevels(questions);
console.log('\n== Уровни ==', levels.length);
let totalGrid = 0;
let totalExtra = 0;
let totalCells = 0;

const started = Date.now();
levels.forEach((level) => {
  const prepared = C.prepareLevel(level);
  const placed = prepared.board.words.length;
  const extra = prepared.extraIds.length;
  totalGrid += placed;
  totalExtra += extra;
  totalCells += prepared.board.cells.size;
  console.log(
    `${String(level.index + 1).padStart(2)}. ${level.title}`.padEnd(48),
    `слов ${String(level.questions.length).padStart(2)}`,
    `сетка ${placed}`,
    `доп ${extra}`,
    `размер ${prepared.board.width}x${prepared.board.height}`,
    extra ? `доп.id: ${prepared.extraIds.join(',')}` : ''
  );
});

console.log('\nИтого в сетках:', totalGrid, 'вне сетки:', totalExtra, 'клеток:', totalCells);
console.log('Время генерации всех уровней, мс:', Date.now() - started);

// Проверка корректности: каждая буква клетки совпадает с буквой своего слова.
let broken = 0;
levels.forEach((level) => {
  const prepared = C.prepareLevel(level);
  prepared.board.words.forEach((word) => {
    word.cells.forEach((pos, index) => {
      const cell = prepared.board.cells.get(C.cellKey(pos.row, pos.col));
      if (!cell || cell.letter !== word.text[index]) broken += 1;
    });
  });
  if (prepared.board.width > C.MAX_GRID_SIZE || prepared.board.height > C.MAX_GRID_SIZE) broken += 1;
});
console.log('Повреждённых клеток / негабаритных сеток:', broken);

// Детерминированность: две генерации подряд дают одну сетку.
const a = C.prepareLevel(levels[0]);
const b = C.prepareLevel(levels[0]);
console.log('Детерминированность:', JSON.stringify(a.board.width + 'x' + a.board.height) === JSON.stringify(b.board.width + 'x' + b.board.height) ? 'ok' : 'FAIL');

// Нормализация
const samples = ['мем', 'МЕМ', '  Кринж  ', 'Человек-паук', 'Человек паук', 'Звёздные войны', 'ёлка'];
console.log('\n== Нормализация ==');
samples.forEach((s) => console.log(JSON.stringify(s), '->', C.normalizeAnswer(s)));

process.exitCode = validation.ok && broken === 0 ? 0 : 1;
