/*
 * Ядро кроссворда: нормализация ответов, проверка данных, разбиение на
 * уровни и генерация сетки.
 *
 * Файл не зависит от DOM, поэтому его можно запускать и в браузере,
 * и в Node для проверок.
 */
(function (global) {
  'use strict';

  // Слово длиннее этого не ставим в сетку, а показываем как дополнительное.
  const MAX_WORD_LENGTH = 15;
  // Максимальный размер сетки по каждой стороне.
  const MAX_GRID_SIZE = 16;
  // Сколько вопросов в одном уровне.
  const WORDS_PER_LEVEL = 10;
  // Сколько подсказок доступно на уровень.
  const HINTS_PER_LEVEL = 4;
  // Сколько попыток даётся на уровень до мини-игры.
  const ATTEMPTS_PER_LEVEL = 4;

  /**
   * Приводит ответ к виду, в котором он сравнивается и попадает в сетку:
   * верхний регистр, ё → е, остаются только буквы и цифры.
   */
  function normalizeAnswer(value) {
    return String(value == null ? '' : value)
      .toUpperCase()
      .replace(/Ё/g, 'Е')
      .replace(/[^0-9A-ZА-Я]/g, '');
  }

  /** Буквы слова, которые реально встают в клетки сетки. */
  function getGridText(question) {
    return normalizeAnswer(question.gridAnswer || question.answer);
  }

  /** Человеческое написание ответа без лишних пробелов. */
  function getDisplayAnswer(question) {
    return String(question.answer || '').trim();
  }

  function normalizeAcceptedAnswers(question) {
    const list = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
    const all = [question.answer].concat(list);
    const seen = new Set();
    const result = [];
    all.forEach(function (value) {
      const normalized = normalizeAnswer(value);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    });
    return result;
  }

  /**
   * Проверка набора вопросов. Ничего не бросает: возвращает список
   * ошибок (данные сломаны) и предупреждений (данные спорные).
   */
  function validateQuestions(questions) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(questions) || questions.length === 0) {
      return { ok: false, errors: ['Список вопросов пуст или не является массивом'], warnings: warnings };
    }

    const ids = new Set();
    const texts = new Map();

    questions.forEach(function (item, index) {
      const label = 'Запись #' + (index + 1) + (item && item.id ? ' (id ' + item.id + ')' : '');

      if (!item || typeof item !== 'object') {
        errors.push(label + ': запись не является объектом');
        return;
      }

      if (!Number.isInteger(item.id)) {
        errors.push(label + ': id должен быть целым числом');
      } else if (ids.has(item.id)) {
        errors.push(label + ': повторяющийся id');
      } else {
        ids.add(item.id);
      }

      if (typeof item.question !== 'string' || item.question.trim() === '') {
        errors.push(label + ': пустой вопрос');
      }

      if (typeof item.answer !== 'string' || item.answer.trim() === '') {
        errors.push(label + ': пустой ответ');
      }

      if (item.acceptedAnswers != null && !Array.isArray(item.acceptedAnswers)) {
        errors.push(label + ': acceptedAnswers должен быть массивом');
      }

      const text = getGridText(item);
      if (!/^[0-9A-ZА-Я]+$/.test(text)) {
        errors.push(label + ': ответ содержит недопустимые для сетки символы');
      }
      if (text.length < 2) {
        errors.push(label + ': ответ короче двух символов, сетка его не примет');
      }
      if (text.length > 15) {
        warnings.push(label + ': ответ длиннее 15 букв, точно уйдёт в дополнительные слова');
      }

      if (texts.has(text)) {
        errors.push(label + ': такой же ответ уже есть у id ' + texts.get(text));
      } else {
        texts.set(text, item.id);
      }
    });

    if (questions.length < WORDS_PER_LEVEL) {
      warnings.push('В наборе ' + questions.length + ' записей — меньше одного уровня');
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  /** Перемешивает массив с воспроизводимым результатом. */
  function shuffleWithSeed(items, seed) {
    const random = mulberry32(seed);
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      const temporary = copy[index];
      copy[index] = copy[swap];
      copy[swap] = temporary;
    }
    return copy;
  }

  /**
   * Делит вопросы на 10 уровней по 10 (без тематических групп). Длинные
   * и короткие слова распределяются равномерно, чтобы сетки собирались.
   * Слова, которым не нашлось места в сетке уровня, становятся
   * дополнительными словами того же уровня (их всё равно нужно решить).
   */
  function buildLevels(questions) {
    const shuffled = shuffleWithSeed(questions, 20261027);
    const withText = shuffled.map(function (item) {
      return { question: item, text: getGridText(item) };
    });

    const levelsCount = Math.ceil(questions.length / WORDS_PER_LEVEL);

    // Сначала длинные, чтобы длинные легли в первые корзины равномерно.
    const sorted = withText.slice().sort(function (a, b) {
      if (b.text.length !== a.text.length) return b.text.length - a.text.length;
      return b.question.id - a.question.id;
    });

    const buckets = [];
    for (let index = 0; index < levelsCount; index += 1) {
      buckets.push([]);
    }
    sorted.forEach(function (item) {
      // Ищем корзину с наименьшим суммарным количеством букв.
      let best = 0;
      for (let index = 1; index < levelsCount; index += 1) {
        if (bucketWeight(buckets[index]) < bucketWeight(buckets[best])) best = index;
      }
      buckets[best].push(item.question);
    });

    return buckets.map(function (items, index) {
      const mixed = shuffleWithSeed(items, 101 + index * 37);
      return {
        index: index,
        id: 'level-' + (index + 1),
        title: 'Уровень ' + (index + 1),
        questions: mixed,
        extraQuestions: []
      };
    });
  }

  /** Суммарная длина всех слов в корзине (упрощённо — количество букв). */
  function bucketWeight(items) {
    let total = 0;
    items.forEach(function (item) {
      total += getGridText(item).length;
    });
    return total;
  }

  /* ------------------------------------------------------------------ */
  /* Генерация сетки                                                     */
  /* ------------------------------------------------------------------ */

  function mulberry32(seed) {
    let state = seed | 0;
    return function random() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cellKey(row, col) {
    return row + ':' + col;
  }

  /**
   * Можно ли поставить слово в указанную позицию.
   * Возвращает число пересечений или null, если ставить нельзя.
   */
  function countCrossings(occupied, word, row, col, horizontal) {
    const dr = horizontal ? 0 : 1;
    const dc = horizontal ? 1 : 0;
    let crossings = 0;

    // Клетки перед словом и после него должны быть пустыми,
    // иначе новое слово «приклеится» к чужому.
    if (occupied.has(cellKey(row - dr, col - dc))) return null;
    if (occupied.has(cellKey(row + dr * word.length, col + dc * word.length))) return null;

    for (let i = 0; i < word.length; i += 1) {
      const rr = row + dr * i;
      const cc = col + dc * i;
      const existing = occupied.get(cellKey(rr, cc));

      if (existing) {
        if (existing.ch !== word[i]) return null;
        // Слово не должно ложиться поверх слова того же направления.
        if (horizontal ? existing.h : existing.v) return null;
        crossings += 1;
      } else if (horizontal) {
        // Над и под новой буквой не должно быть чужих букв.
        if (occupied.has(cellKey(rr - 1, cc)) || occupied.has(cellKey(rr + 1, cc))) return null;
      } else {
        if (occupied.has(cellKey(rr, cc - 1)) || occupied.has(cellKey(rr, cc + 1))) return null;
      }
    }

    // Одиночная буква без пересечений допускается только для первого слова.
    return crossings;
  }

  /** Состояние сборки: занятые клетки и текущие границы. */
  function createState() {
    return {
      cells: new Map(),
      minRow: Infinity,
      maxRow: -Infinity,
      minCol: Infinity,
      maxCol: -Infinity
    };
  }

  /** Ставит слово на сетку и возвращает данные для отката. */
  function applyPlacement(state, entry, option) {
    const horizontal = option.horizontal;
    const row = option.row;
    const col = option.col;
    const undoCells = [];

    for (let i = 0; i < entry.text.length; i += 1) {
      const rr = row + (horizontal ? 0 : i);
      const cc = col + (horizontal ? i : 0);
      const key = cellKey(rr, cc);
      const existing = state.cells.get(key);

      if (existing) {
        undoCells.push({ key: key, created: false, h: existing.h, v: existing.v });
        if (horizontal) existing.h = true;
        else existing.v = true;
      } else {
        state.cells.set(key, { ch: entry.text[i], h: horizontal, v: !horizontal });
        undoCells.push({ key: key, created: true });
      }
    }

    const undoBounds = {
      minRow: state.minRow,
      maxRow: state.maxRow,
      minCol: state.minCol,
      maxCol: state.maxCol
    };

    const endRow = row + (horizontal ? 0 : entry.text.length - 1);
    const endCol = col + (horizontal ? entry.text.length - 1 : 0);
    state.minRow = Math.min(state.minRow, row);
    state.maxRow = Math.max(state.maxRow, endRow);
    state.minCol = Math.min(state.minCol, col);
    state.maxCol = Math.max(state.maxCol, endCol);

    return { cells: undoCells, bounds: undoBounds };
  }

  /** Убирает слово с сетки, возвращая состояние «как было». */
  function revertPlacement(state, undo) {
    for (let i = undo.cells.length - 1; i >= 0; i -= 1) {
      const item = undo.cells[i];
      if (item.created) {
        state.cells.delete(item.key);
      } else {
        const cell = state.cells.get(item.key);
        cell.h = item.h;
        cell.v = item.v;
      }
    }
    state.minRow = undo.bounds.minRow;
    state.maxRow = undo.bounds.maxRow;
    state.minCol = undo.bounds.minCol;
    state.maxCol = undo.bounds.maxCol;
  }

  /** Все допустимые позиции слова, лучшие — первыми. */
  function findCandidates(state, entry, maxSize, random, limit) {
    const text = entry.text;

    if (state.cells.size === 0) {
      return [{ row: 0, col: 0, horizontal: true, crossings: 0, score: 0 }];
    }

    const options = [];
    const seen = new Set();

    state.cells.forEach(function (cell, key) {
      const parts = key.split(':');
      const baseRow = Number(parts[0]);
      const baseCol = Number(parts[1]);

      for (let index = 0; index < text.length; index += 1) {
        if (text[index] !== cell.ch) continue;

        const directions = [true, false];
        for (let d = 0; d < directions.length; d += 1) {
          const horizontal = directions[d];
          const row = horizontal ? baseRow : baseRow - index;
          const col = horizontal ? baseCol - index : baseCol;

          const crossings = countCrossings(state.cells, text, row, col, horizontal);
          if (!crossings) continue;

          const endRow = row + (horizontal ? 0 : text.length - 1);
          const endCol = col + (horizontal ? text.length - 1 : 0);
          const minRow = Math.min(state.minRow, row);
          const maxRow = Math.max(state.maxRow, endRow);
          const minCol = Math.min(state.minCol, col);
          const maxCol = Math.max(state.maxCol, endCol);
          const width = maxCol - minCol + 1;
          const height = maxRow - minRow + 1;

          if (width > maxSize || height > maxSize) continue;

          const positionKey = row + ':' + col + ':' + (horizontal ? 'h' : 'v');
          if (seen.has(positionKey)) continue;
          seen.add(positionKey);

          // Много пересечений и компактная сетка — хорошо.
          options.push({
            row: row,
            col: col,
            horizontal: horizontal,
            crossings: crossings,
            score: crossings * 70 - width * height * 0.9 + random() * 6
          });
        }
      }
    });

    options.sort(function (a, b) {
      return b.score - a.score;
    });

    return options.slice(0, limit || 12);
  }

  /**
   * Одна попытка сборки: перебор с возвратом. Он позволяет «переставить»
   * уже поставленные слова, если из-за них не влезает последнее.
   */
  function attemptLayout(entries, random, maxSize, nodeBudget) {
    const order = entries.map(function (entry) {
      return { entry: entry, jitter: random() };
    });
    order.sort(function (a, b) {
      const av = a.entry.text.length + a.jitter * 2.5;
      const bv = b.entry.text.length + b.jitter * 2.5;
      return bv - av;
    });

    const state = createState();
    const placed = [];
    let crossings = 0;
    let nodes = 0;
    let best = null;
    let bestScore = -Infinity;

    function snapshot() {
      if (!placed.length) return;
      const width = state.maxCol - state.minCol + 1;
      const height = state.maxRow - state.minRow + 1;
      const score = placed.length * 10000 + crossings * 60 - width * height;
      if (score <= bestScore) return;

      bestScore = score;
      best = {
        placements: placed.map(function (item) {
          return {
            id: item.entry.id,
            text: item.entry.text,
            row: item.row - state.minRow,
            col: item.col - state.minCol,
            horizontal: item.horizontal
          };
        }),
        width: width,
        height: height,
        crossings: crossings
      };
    }

    function search(index) {
      nodes += 1;
      if (nodes > nodeBudget) return;

      // Если даже теоретически не обогнать лучшее решение — дальше не идём.
      if (placed.length + (order.length - index) < (best ? best.placements.length : 0)) return;

      if (index >= order.length) {
        snapshot();
        return;
      }

      const entry = order[index].entry;
      const options = findCandidates(state, entry, maxSize, random, 12);

      for (let i = 0; i < options.length; i += 1) {
        const option = options[i];
        const undo = applyPlacement(state, entry, option);
        placed.push({
          entry: entry,
          row: option.row,
          col: option.col,
          horizontal: option.horizontal
        });
        const savedCrossings = crossings;
        crossings += option.crossings;

        snapshot();
        search(index + 1);

        crossings = savedCrossings;
        placed.pop();
        revertPlacement(state, undo);

        if (nodes > nodeBudget) return;
      }

      // Вариант «слово не влезло» — последним.
      search(index + 1);
    }

    search(0);

    const placedIds = new Set();
    if (best) {
      best.placements.forEach(function (item) {
        placedIds.add(item.id);
      });
    }

    const unplaced = entries.filter(function (entry) {
      return !placedIds.has(entry.id);
    });

    if (!best) {
      return { placements: [], unplaced: entries.slice(), width: 0, height: 0, crossings: 0 };
    }

    return {
      placements: best.placements,
      unplaced: unplaced,
      width: best.width,
      height: best.height,
      crossings: best.crossings
    };
  }

  /**
   * Подбирает раскладку сетки. Один и тот же seed всегда даёт одну и ту же
   * сетку, поэтому прогресс игрока не «съезжает» после перезагрузки.
   */
  function generateCrossword(words, options) {
    const settings = options || {};
    const maxSize = settings.maxSize || MAX_GRID_SIZE;
    const attempts = settings.attempts || 12;
    const budget = settings.nodeBudget || 4000;
    const seed = settings.seed || 1;
    const random = mulberry32(seed);

    let best = null;
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!words.length) break;
      const layout = attemptLayout(words, random, maxSize, budget);
      if (!layout.placements.length) continue;

      const score = layout.placements.length * 10000 + layout.crossings * 60
        - layout.width * layout.height;
      if (score > bestScore) {
        bestScore = score;
        best = layout;
      }

      if (best.placements.length === words.length) break;
    }

    if (!best) {
      return { placements: [], unplaced: words.slice(), width: 0, height: 0, crossings: 0 };
    }

    return best;
  }

  /** Превращает раскладку в клетки с номерами — то, что рисует интерфейс. */
  function buildBoard(layout) {
    const words = layout.placements.map(function (placement) {
      const cells = [];
      for (let i = 0; i < placement.text.length; i += 1) {
        cells.push({
          row: placement.row + (placement.horizontal ? 0 : i),
          col: placement.col + (placement.horizontal ? i : 0)
        });
      }
      return {
        id: placement.id,
        text: placement.text,
        row: placement.row,
        col: placement.col,
        horizontal: placement.horizontal,
        cells: cells
      };
    });

    // Номера: обход сверху вниз, слева направо по начальным клеткам слов.
    const numberByStart = new Map();
    const sortedStarts = words.slice().sort(function (a, b) {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    let nextNumber = 1;
    sortedStarts.forEach(function (word) {
      const startKey = cellKey(word.row, word.col);
      if (!numberByStart.has(startKey)) {
        numberByStart.set(startKey, nextNumber);
        nextNumber += 1;
      }
      word.number = numberByStart.get(startKey);
    });

    const cells = new Map();
    words.forEach(function (word) {
      word.cells.forEach(function (position, index) {
        const key = cellKey(position.row, position.col);
        let cell = cells.get(key);
        if (!cell) {
          cell = {
            row: position.row,
            col: position.col,
            letter: word.text[index],
            numbers: [],
            across: null,
            down: null
          };
          cells.set(key, cell);
        }
        if (word.horizontal) cell.across = word.id;
        else cell.down = word.id;
        if (word.number && cell.numbers.indexOf(word.number) === -1) {
          cell.numbers.push(word.number);
          cell.numbers.sort(function (a, b) { return a - b; });
        }
      });
    });

    return {
      width: layout.width,
      height: layout.height,
      words: words,
      cells: cells
    };
  }

  /**
   * Готовит уровень: сетку и дополнительные вопросы вне сетки.
   */
  function prepareLevel(level) {
    const entries = level.questions.map(function (item) {
      return { id: item.id, text: getGridText(item) };
    });

    const extraQuestions = level.extraQuestions || [];
    const extraEntries = extraQuestions.map(function (item) {
      return { id: item.id, text: getGridText(item) };
    });

    const layout = generateCrossword(entries, {
      maxSize: MAX_GRID_SIZE,
      attempts: 60,
      nodeBudget: 12000,
      seed: 7919 + level.index * 131
    });

    const board = buildBoard(layout);
    const unplacedIds = layout.unplaced.map(function (entry) { return entry.id; });
    const extraIds = extraEntries.map(function (entry) { return entry.id; }).concat(unplacedIds);

    return {
      index: level.index,
      id: level.id,
      title: level.title,
      questions: level.questions,
      extraQuestions: extraQuestions,
      board: board,
      extraIds: extraIds
    };
  }

  const api = {
    MAX_WORD_LENGTH: MAX_WORD_LENGTH,
    MAX_GRID_SIZE: MAX_GRID_SIZE,
    WORDS_PER_LEVEL: WORDS_PER_LEVEL,
    HINTS_PER_LEVEL: HINTS_PER_LEVEL,
    ATTEMPTS_PER_LEVEL: ATTEMPTS_PER_LEVEL,
    normalizeAnswer: normalizeAnswer,
    getGridText: getGridText,
    getDisplayAnswer: getDisplayAnswer,
    normalizeAcceptedAnswers: normalizeAcceptedAnswers,
    validateQuestions: validateQuestions,
    buildLevels: buildLevels,
    generateCrossword: generateCrossword,
    buildBoard: buildBoard,
    prepareLevel: prepareLevel,
    cellKey: cellKey
  };

  global.Crossword = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
