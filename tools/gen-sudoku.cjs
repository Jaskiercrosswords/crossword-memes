/*
 * Генерирует несколько судоку 4×4 с единственным решением.
 * Запуск: multitool-node tools/gen-sudoku.cjs
 */
'use strict';

const BASE = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1]
];

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  return copy;
}

function permuteSolution() {
  // Перестановки цифр, строк внутри полос и столбцов внутри стеков
  // сохраняют корректность судоку.
  const digits = shuffle([1, 2, 3, 4]);
  const map = new Map(digits.map((value, index) => [index + 1, value]));

  let grid = BASE.map((row) => row.map((value) => map.get(value)));

  if (Math.random() < 0.5) {
    grid = [grid[1], grid[0], grid[3], grid[2]];
  }
  if (Math.random() < 0.5) {
    grid = [grid[2], grid[3], grid[0], grid[1]];
  }
  if (Math.random() < 0.5) {
    grid = grid.map((row) => [row[1], row[0], row[3], row[2]]);
  }
  if (Math.random() < 0.5) {
    grid = grid.map((row) => [row[2], row[3], row[0], row[1]]);
  }

  return grid;
}

function solveCount(grid, limit) {
  let count = 0;
  const work = grid.map((row) => row.slice());

  function valid(r, c, value) {
    for (let i = 0; i < 4; i += 1) {
      if (work[r][i] === value || work[i][c] === value) return false;
    }
    const br = r - (r % 2);
    const bc = c - (c % 2);
    for (let i = 0; i < 2; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        if (work[br + i][bc + j] === value) return false;
      }
    }
    return true;
  }

  function go() {
    if (count >= limit) return;
    let row = -1;
    let col = -1;
    for (let i = 0; i < 4 && row === -1; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        if (work[i][j] === 0) {
          row = i;
          col = j;
          break;
        }
      }
    }
    if (row === -1) {
      count += 1;
      return;
    }
    for (let value = 1; value <= 4; value += 1) {
      if (valid(row, col, value)) {
        work[row][col] = value;
        go();
        work[row][col] = 0;
      }
    }
  }

  go();
  return count;
}

function makePuzzle() {
  const solution = permuteSolution();
  const puzzle = solution.map((row) => row.slice());

  const cells = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) cells.push([r, c]);
  }

  let givens = 16;
  shuffle(cells).forEach(([r, c]) => {
    if (givens <= 7) return;
    const saved = puzzle[r][c];
    puzzle[r][c] = 0;
    if (solveCount(puzzle, 2) !== 1) {
      puzzle[r][c] = saved;
    } else {
      givens -= 1;
    }
  });

  return { solution: solution, givens: puzzle };
}

const puzzles = [];
const seen = new Set();

while (puzzles.length < 6) {
  const puzzle = makePuzzle();
  const key = JSON.stringify(puzzle.givens);
  if (seen.has(key)) continue;
  seen.add(key);
  puzzles.push(puzzle);
}

puzzles.forEach((puzzle) => {
  console.log('  {');
  console.log('    solution: ' + JSON.stringify(puzzle.solution) + ',');
  console.log('    givens: ' + JSON.stringify(puzzle.givens));
  console.log('  },');
  console.log('  // проверка: решений ' + solveCount(puzzle.givens, 3)
    + ', подсказок ' + puzzle.givens.flat().filter(Boolean).length);
});
