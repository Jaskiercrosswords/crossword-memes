/*
 * Игровой контроллер: экраны, сетка, ввод, подсказки и сохранение.
 * Зависит от questions.js, crossword.js, storage.js, platform.js и ads.js.
 */
(function () {
  'use strict';

  const C = window.Crossword;
  const Store = window.Storage;
  const Platform = window.Platform;
  const Ads = window.Ads;

  const DIFFICULTY_LABELS = {
    easy: 'простое',
    medium: 'среднее',
    hard: 'сложное'
  };

  const KEYBOARD_ROWS = ['ЙЦУКЕНГШЩЗХЪ', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬБЮЁ'];
  const DIGITS = '1234567890';

  // Шесть лёгких судоку 4×4 с единственным решением.
  const SUDOKU_PUZZLES = [
    {
      solution: [[4, 3, 2, 1], [2, 1, 4, 3], [3, 4, 1, 2], [1, 2, 3, 4]],
      givens: [[0, 3, 2, 1], [0, 1, 0, 3], [0, 0, 1, 0], [0, 2, 0, 0]]
    },
    {
      solution: [[4, 3, 2, 1], [2, 1, 4, 3], [3, 4, 1, 2], [1, 2, 3, 4]],
      givens: [[4, 0, 0, 1], [0, 1, 0, 3], [0, 4, 0, 0], [1, 2, 0, 0]]
    },
    {
      solution: [[4, 3, 2, 1], [2, 1, 4, 3], [3, 4, 1, 2], [1, 2, 3, 4]],
      givens: [[0, 0, 0, 0], [2, 1, 0, 3], [0, 4, 0, 2], [0, 0, 3, 4]]
    },
    {
      solution: [[1, 3, 2, 4], [2, 4, 1, 3], [3, 1, 4, 2], [4, 2, 3, 1]],
      givens: [[1, 3, 2, 0], [2, 0, 1, 0], [0, 0, 0, 0], [4, 2, 0, 0]]
    },
    {
      solution: [[4, 1, 3, 2], [3, 2, 4, 1], [1, 4, 2, 3], [2, 3, 1, 4]],
      givens: [[4, 0, 0, 2], [0, 2, 0, 1], [0, 4, 2, 0], [2, 0, 0, 0]]
    },
    {
      solution: [[3, 1, 4, 2], [4, 2, 3, 1], [1, 3, 2, 4], [2, 4, 1, 3]],
      givens: [[0, 0, 4, 0], [0, 0, 0, 1], [1, 3, 0, 4], [0, 4, 0, 3]]
    }
  ];


  const el = {};
  let levelMeta = [];
  const preparedCache = new Map();
  let questionsById = new Map();
  let progress = Store.emptyProgress();
  let game = null;
  let sudokuState = null;
  let lastSudokuIndex = -1;
  let toastTimer = null;
  let audioContext = null;
  let lastFocused = null;

  /* ------------------------------------------------------------- утилиты */

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function showToast(message, isError) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.toggle('toast--error', Boolean(isError));
    el.toast.hidden = false;
    // принудительный reflow, чтобы анимация сработала повторно
    void el.toast.offsetWidth;
    el.toast.classList.add('is-visible');

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.toast.classList.remove('is-visible');
      window.setTimeout(function () {
        el.toast.hidden = true;
      }, 200);
    }, 2100);
  }

  function playTone(frequency, duration) {
    if (!progress.settings || !progress.settings.sound) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = audioContext || new AudioCtor();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch (error) {
      /* звук не критичен */
    }
  }

  /* ---------------------------------------------------------------- старт */

  function cacheElements() {
    el.screenStart = $('screen-start');
    el.screenGame = $('screen-game');
    el.btnPlay = $('btn-play');
    el.btnHowto = $('btn-howto');
    el.statWords = $('stat-words');
    el.statLevels = $('stat-levels');
    el.statSolved = $('stat-solved');
    el.startProgress = $('start-progress');
    el.startBar = $('start-bar');
    el.startBarWrap = $('start-bar-wrap');
    el.startProgressText = $('start-progress-text');

    el.btnMenu = $('btn-menu');
    el.levelTitle = $('level-title');
    el.levelStats = $('level-stats');
    el.levelBar = $('level-bar');
    el.levelBarWrap = $('level-bar-wrap');

    el.clueNumber = $('clue-number');
    el.clueText = $('clue-text');
    el.clueMeta = $('clue-meta');
    el.dirAcross = $('dir-across');
    el.dirDown = $('dir-down');
    el.btnCheck = $('btn-check');
    el.btnHint = $('btn-hint');
    el.btnClear = $('btn-clear');
    el.hintsLeft = $('hints-left');

    el.board = $('board');
    el.boardPanel = $('board-panel');
    el.boardEmpty = $('board-empty');
    el.extras = $('extras');
    el.extrasList = $('extras-list');
    el.extrasToggle = $('extras-toggle');
    el.extrasCount = $('extras-count');
    el.keyboard = $('keyboard');

    el.screenSudoku = $('screen-sudoku');
    el.sudokuBoard = $('sudoku-board');
    el.sudokuKeys = $('sudoku-keys');
    el.sudokuStatus = $('sudoku-status');
    el.btnSudokuCheck = $('btn-sudoku-check');

    el.modalMenu = $('modal-menu');
    el.modalHowto = $('modal-howto');
    el.modalDone = $('modal-level-done');
    el.modalConfirm = $('modal-confirm');
    el.modalHint = $('modal-hint');
    el.modalAttempts = $('modal-attempts');
    el.btnAttemptsSudoku = $('btn-attempts-sudoku');
    el.hintText = $('hint-text');
    el.btnHintClose = $('btn-hint-close');
    el.btnHintOk = $('btn-hint-ok');


    el.btnMenuClose = $('btn-menu-close');
    el.btnResume = $('btn-resume');
    el.btnHowto2 = $('btn-howto-2');
    el.btnSound = $('btn-sound');
    el.soundLabel = $('sound-label');
    el.btnReset = $('btn-reset');
    el.levelList = $('level-list');

    el.btnHowtoClose = $('btn-howto-close');
    el.btnHowtoOk = $('btn-howto-ok');

    el.doneTitle = $('done-title');
    el.doneEyebrow = $('done-eyebrow');
    el.doneWords = $('done-words');
    el.doneHints = $('done-hints');
    el.btnNextLevel = $('btn-next-level');
    el.btnDoneMenu = $('btn-done-menu');

    el.confirmTitle = $('confirm-title');
    el.confirmText = $('confirm-text');
    el.btnConfirmYes = $('btn-confirm-yes');
    el.btnConfirmNo = $('btn-confirm-no');

    el.toast = $('toast');
  }

  function init() {
    cacheElements();

    const validation = C.validateQuestions(window.QUESTIONS);
    if (validation.warnings.length) {
      console.warn('Данные вопросов: предупреждения', validation.warnings);
    }
    if (!validation.ok) {
      console.error('Данные вопросов: ошибки', validation.errors);
    }

    window.QUESTIONS.forEach(function (item) {
      questionsById.set(item.id, item);
    });

    levelMeta = C.buildLevels(window.QUESTIONS);
    progress = Store.load();

    buildKeyboard();
    buildSudokuKeys();
    bindEvents();
    renderStartScreen();
    updateSoundUi();

    if (!Store.isAvailable()) {
      console.warn('localStorage недоступен: прогресс сохранится только до перезагрузки.');
    }

    Platform.init().then(function (ready) {
      if (ready) Platform.readyGameplay();
    });
  }

  /* ---------------------------------------------------------------- меню */

  function openModal(node) {
    if (!node) return;
    lastFocused = document.activeElement;
    node.hidden = false;
    const focusable = node.querySelector('button:not([disabled])');
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function closeModal(node) {
    if (!node) return;
    node.hidden = true;
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
  }

  function closeAllModals() {
    [el.modalMenu, el.modalHowto, el.modalDone, el.modalConfirm, el.modalHint, el.modalAttempts].forEach(function (node) {
      if (node) node.hidden = true;
    });
  }

  function anyModalOpen() {
    return [el.modalMenu, el.modalHowto, el.modalDone, el.modalConfirm, el.modalHint, el.modalAttempts].some(function (node) {
      return node && !node.hidden;
    });
  }

  /* ---------------------------------------------------------- старт-экран */

  function countSolvedTotal() {
    let total = 0;
    Object.keys(progress.levels).forEach(function (key) {
      const entry = progress.levels[key];
      if (entry && Array.isArray(entry.solved)) total += entry.solved.length;
    });
    return total;
  }

  function isLevelUnlocked(index) {
    if (index === 0) return true;
    const previous = levelMeta[index - 1];
    if (!previous) return false;
    const entry = progress.levels[previous.id];
    return Boolean(entry && entry.completed);
  }

  function renderStartScreen() {
    const totalSolved = countSolvedTotal();
    el.statWords.textContent = String(window.QUESTIONS.length);
    el.statLevels.textContent = String(levelMeta.length);
    el.statSolved.textContent = String(totalSolved);

    const hasProgress = totalSolved > 0;
    el.startProgress.hidden = !hasProgress;

    if (hasProgress) {
      const percent = Math.round((totalSolved / window.QUESTIONS.length) * 100);
      el.startBar.style.width = percent + '%';
      el.startBarWrap.setAttribute('aria-valuenow', String(totalSolved));
      el.startBarWrap.setAttribute('aria-valuemax', String(window.QUESTIONS.length));

      const index = clamp(progress.currentLevel, 0, levelMeta.length - 1);
      const level = levelMeta[index];
      const solvedInLevel = progress.levels[level.id] ? progress.levels[level.id].solved.length : 0;
      el.startProgressText.textContent = 'Продолжишь с уровня ' + (index + 1)
        + ' из ' + levelMeta.length + ' — «' + level.title + '», '
        + solvedInLevel + ' из ' + level.questions.length + ' слов';
    }

    el.btnPlay.textContent = hasProgress ? 'Продолжить игру' : 'Играть';
  }

  /* ------------------------------------------------------------- уровень */

  function getPrepared(index) {
    if (!preparedCache.has(index)) {
      preparedCache.set(index, C.prepareLevel(levelMeta[index]));
    }
    return preparedCache.get(index);
  }

  function ensureLevelProgress(levelId) {
    if (!progress.levels[levelId]) {
      progress.levels[levelId] = {
        solved: [],
        revealed: {},
        hintsLeft: C.HINTS_PER_LEVEL,
        hintsUsed: 0,
        attemptsLeft: C.ATTEMPTS_PER_LEVEL,
        completed: false
      };
    }
    const entry = progress.levels[levelId];
    if (!Array.isArray(entry.solved)) entry.solved = [];
    if (!entry.revealed || typeof entry.revealed !== 'object') entry.revealed = {};
    if (typeof entry.hintsLeft !== 'number') entry.hintsLeft = C.HINTS_PER_LEVEL;
    if (typeof entry.hintsUsed !== 'number') entry.hintsUsed = 0;
    if (typeof entry.attemptsLeft !== 'number') entry.attemptsLeft = C.ATTEMPTS_PER_LEVEL;
    return entry;
  }

  function buildExtraCells(question, text) {
    const display = String(question.answer || '').trim();
    const cells = [];
    let pendingSeparator = '';
    let index = 0;

    Array.from(display).forEach(function (character) {
      const normalized = C.normalizeAnswer(character);
      if (!normalized) {
        pendingSeparator += character === ' ' ? ' ' : character;
        return;
      }
      cells.push({
        key: 'x' + question.id + ':' + index,
        separator: pendingSeparator,
        letter: normalized
      });
      pendingSeparator = '';
      index += 1;
    });

    // Страховка: подписи должны совпадать с сеточным вариантом ответа.
    while (cells.length < text.length) {
      cells.push({ key: 'x' + question.id + ':' + cells.length, separator: '', letter: text[cells.length] });
    }

    return cells;
  }

  function buildRuntime(prepared, levelIndex, saved) {
    const words = [];
    const cellState = new Map();

    prepared.board.words.forEach(function (boardWord) {
      const question = questionsById.get(boardWord.id);
      if (!question) return;
      words.push({
        id: boardWord.id,
        question: question.question,
        display: question.answer,
        text: boardWord.text,
        accepted: C.normalizeAcceptedAnswers(question),
        difficulty: question.difficulty,
        specialHint: question.specialHint || '',
        isGrid: true,
        number: boardWord.number,
        horizontal: boardWord.horizontal,
        cells: boardWord.cells.map(function (position) {
          return { key: C.cellKey(position.row, position.col), row: position.row, col: position.col };
        })
      });
    });

    prepared.extraIds.forEach(function (id) {
      const question = questionsById.get(id);
      if (!question) return;
      const text = C.getGridText(question);
      words.push({
        id: id,
        question: question.question,
        display: question.answer,
        text: text,
        accepted: C.normalizeAcceptedAnswers(question),
        difficulty: question.difficulty,
        specialHint: question.specialHint || '',
        isGrid: false,
        number: null,
        horizontal: true,
        cells: buildExtraCells(question, text)
      });
    });

    words.sort(function (a, b) {
      if (a.isGrid !== b.isGrid) return a.isGrid ? -1 : 1;
      if (a.isGrid) {
        if (a.number !== b.number) return a.number - b.number;
        return a.horizontal === b.horizontal ? 0 : (a.horizontal ? -1 : 1);
      }
      return a.id - b.id;
    });

    const wordsById = new Map();
    words.forEach(function (word) {
      wordsById.set(word.id, word);
      word.cells.forEach(function (cell) {
        if (!cellState.has(cell.key)) {
          cellState.set(cell.key, { ch: '', fixed: false, hinted: false, solved: false, wrong: false });
        }
      });
    });

    const solved = new Set(saved.solved);
    const revealed = {};

    Object.keys(saved.revealed).forEach(function (key) {
      const id = Number(key);
      if (!Number.isInteger(id)) return;
      revealed[id] = saved.revealed[key].slice();
    });

    const runtime = {
      levelIndex: levelIndex,
      prepared: prepared,
      words: words,
      gridWords: words.filter(function (word) { return word.isGrid; }),
      extraWords: words.filter(function (word) { return !word.isGrid; }),
      wordsById: wordsById,
      cellState: cellState,
      cellEls: new Map(),
      solved: solved,
      revealed: revealed,
      hintsLeft: saved.hintsLeft,
      hintsUsed: saved.hintsUsed,
      attemptsLeft: typeof saved.attemptsLeft === 'number'
        ? saved.attemptsLeft
        : C.ATTEMPTS_PER_LEVEL,
      hintPlateShown: new Set(),
      activeId: null,
      activeIndex: 0,
      direction: 'across'
    };

    // Восстанавливаем буквы разгаданных и подсказанных слов.
    words.forEach(function (word) {
      const isSolved = solved.has(word.id);
      const hintedIndexes = revealed[word.id] || [];

      word.cells.forEach(function (cell, index) {
        const state = cellState.get(cell.key);
        if (!state) return;

        if (state.fixed) {
          state.ch = word.text[index];
          return;
        }

        if (isSolved) {
          state.ch = word.text[index];
          state.fixed = true;
          state.solved = true;
        } else if (hintedIndexes.indexOf(index) !== -1) {
          state.ch = word.text[index];
          state.fixed = true;
          state.hinted = true;
        }
      });
    });

    return runtime;
  }

  function startLevel(index) {
    const safeIndex = clamp(index, 0, levelMeta.length - 1);
    const prepared = getPrepared(safeIndex);
    const saved = ensureLevelProgress(prepared.id);

    progress.currentLevel = safeIndex;
    game = buildRuntime(prepared, safeIndex, saved);

    el.screenStart.hidden = true;
    el.screenGame.hidden = false;

    renderBoard();
    renderExtras();
    el.extras.classList.remove('is-open');
    el.extrasToggle.setAttribute('aria-expanded', 'false');
    updateHud();

    const first = firstUnsolvedWord();
    if (first) {
      selectWord(first.id, 0);
    } else {
      selectWord(null, 0);
    }

    // Сразу подгоняем клетки под экран, чтобы не было кадра с широкой сеткой.
    fitBoard();
    requestAnimationFrame(fitBoard);
    saveGame();
    Platform.gameplayStart();

    if (!isLevelComplete() && game.attemptsLeft <= 0) {
      showAttemptsBanner();
    }
  }

  /* -------------------------------------------------------------- отрисовка */

  function renderBoard() {
    const board = game.prepared.board;
    el.board.innerHTML = '';
    game.cellEls.clear();

    const hasGrid = board.width > 0 && board.height > 0;
    el.boardEmpty.hidden = hasGrid;
    el.board.hidden = !hasGrid;

    if (!hasGrid) {
      el.board.style.removeProperty('--cols');
      return;
    }

    el.board.style.setProperty('--cols', String(board.width));
    el.board.style.setProperty('--rows', String(board.height));

    for (let row = 0; row < board.height; row += 1) {
      for (let col = 0; col < board.width; col += 1) {
        const cell = board.cells.get(C.cellKey(row, col));
        const node = document.createElement('div');

        node.style.gridRow = String(row + 1);
        node.style.gridColumn = String(col + 1);

        if (!cell) {
          node.className = 'cell cell--void';
          node.setAttribute('aria-hidden', 'true');
          el.board.appendChild(node);
          continue;
        }

        const key = C.cellKey(row, col);
        const state = game.cellState.get(key);

        node.className = 'cell';
        node.dataset.key = key;
        node.setAttribute('role', 'gridcell');
        node.setAttribute('aria-rowindex', String(row + 1));
        node.setAttribute('aria-colindex', String(col + 1));
        node.tabIndex = -1;
        node.setAttribute('aria-label', 'Клетка ' + (row + 1) + ' ряд, ' + (col + 1) + ' столбец');

        if (cell.numbers.length) {
          const badge = document.createElement('span');
          badge.className = 'cell__num';
          badge.textContent = String(cell.numbers[0]);
          node.appendChild(badge);
        }

        const letter = document.createElement('span');
        letter.className = 'cell__letter';
        letter.textContent = state ? state.ch : '';
        node.appendChild(letter);
        node._letter = letter;

        node.addEventListener('click', function () {
          onCellClick(key);
        });

        game.cellEls.set(key, node);
        el.board.appendChild(node);
      }
    }

    syncCells();
    syncSelection();
  }

  function renderExtras() {
    const extras = game.words.filter(function (word) { return !word.isGrid; });
    el.extras.hidden = extras.length === 0;
    if (el.extrasCount) el.extrasCount.textContent = String(extras.length);
    el.extrasList.innerHTML = '';

    extras.forEach(function (word) {
      const card = document.createElement('div');
      card.className = 'extra';
      card.dataset.id = String(word.id);

      const clue = document.createElement('p');
      clue.className = 'extra__clue';

      const num = document.createElement('span');
      num.className = 'extra__num';
      num.textContent = 'Без сетки.';
      clue.appendChild(num);
      clue.appendChild(document.createTextNode(' ' + word.question));
      card.appendChild(clue);

      const boxes = document.createElement('div');
      boxes.className = 'extra__boxes';

      word.cells.forEach(function (cell, index) {
        if (cell.separator) {
          const separator = document.createElement('span');
          separator.className = 'extra__sep';
          separator.textContent = cell.separator === ' ' ? '\u00A0' : cell.separator;
          boxes.appendChild(separator);
        }

        const box = document.createElement('button');
        box.type = 'button';
        box.className = 'xcell';
        box.dataset.key = cell.key;
        box.setAttribute('aria-label', 'Буква ' + (index + 1));
        box.textContent = '';

        box.addEventListener('click', function () {
          selectWord(word.id, index);
        });

        boxes.appendChild(box);
        game.cellEls.set(cell.key, box);
      });

      card.appendChild(boxes);
      el.extrasList.appendChild(card);
    });

    syncCells();
    syncSelection();
  }

  function paintCell(key) {
    if (!game) return;
    const node = game.cellEls.get(key);
    const state = game.cellState.get(key);
    if (!node || !state) return;

    node.textContent = state.ch || '';

    const isExtra = node.classList.contains('xcell');
    const solvedClass = isExtra ? 'xcell--solved' : 'cell--solved';
    const hintedClass = isExtra ? 'xcell--hinted' : 'cell--hinted';
    const wrongClass = isExtra ? 'xcell--wrong' : 'cell--wrong';

    node.classList.toggle(solvedClass, Boolean(state.solved));
    node.classList.toggle(hintedClass, Boolean(state.hinted) && !state.solved);
    node.classList.toggle(wrongClass, Boolean(state.wrong));
  }

  function syncCells() {
    game.cellState.forEach(function (state, key) {
      paintCell(key);
    });
  }

  function activeWord() {
    if (!game || game.activeId == null) return null;
    return game.wordsById.get(game.activeId) || null;
  }

  function activeKey() {
    const word = activeWord();
    if (!word) return null;
    return word.cells[game.activeIndex].key;
  }

  function syncSelection() {
    if (!game) return;
    const word = activeWord();
    const wordKeys = new Set();
    if (word) {
      word.cells.forEach(function (cell) { wordKeys.add(cell.key); });
    }
    const currentKey = activeKey();

    game.cellEls.forEach(function (node, key) {
      const isWord = wordKeys.has(key);
      const isCurrent = key === currentKey;

      if (node.classList.contains('xcell')) {
        node.classList.toggle('xcell--current', isCurrent);
        node.classList.toggle('xcell--solved', Boolean(node.classList.contains('xcell--solved')));
      } else {
        node.classList.toggle('cell--word', isWord && !isCurrent);
        node.classList.toggle('cell--current', isCurrent);
      }
    });

    document.querySelectorAll('.extra').forEach(function (card) {
      card.classList.toggle('is-active', Boolean(word) && !word.isGrid && card.dataset.id === String(word.id));
      const id = Number(card.dataset.id);
      card.classList.toggle('is-solved', game.solved.has(id));
    });

    syncDirectionTabs();
    syncClue();
    updateDigitRow();
  }

  function syncDirectionTabs() {
    const word = activeWord();
    const horizontal = word ? word.horizontal : (!game || game.direction !== 'down');
    el.dirAcross.classList.toggle('is-active', horizontal);
    el.dirDown.classList.toggle('is-active', !horizontal);
    el.dirAcross.setAttribute('aria-selected', horizontal ? 'true' : 'false');
    el.dirDown.setAttribute('aria-selected', horizontal ? 'false' : 'true');
  }

  function syncClue() {
    const word = activeWord();

    if (!word) {
      el.clueNumber.textContent = '—';
      el.clueText.textContent = 'Выбери слово в сетке';
      el.clueMeta.textContent = 'Нажми на клетку или на подсказку, чтобы начать.';
      return;
    }

    const isSolved = game.solved.has(word.id);
    const letters = word.cells.length;

    el.clueNumber.textContent = word.isGrid
      ? (word.horizontal ? '→ ' : '↓ ') + word.number
      : 'доп.';

    el.clueText.textContent = word.question;

    const parts = [];
    parts.push(letters + ' ' + pluralLetters(letters));
    if (DIFFICULTY_LABELS[word.difficulty]) parts.push(DIFFICULTY_LABELS[word.difficulty]);
    if (isSolved) parts.push('разгадано');
    el.clueMeta.textContent = parts.join(' · ');
  }

  function pluralLetters(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'буква';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'буквы';
    return 'букв';
  }

function gridSolvedCount() {
    if (!game) return 0;
    return game.words.filter(function (word) {
      return game.solved.has(word.id);
    }).length;
  }

  function isLevelComplete() {
    if (!game) return false;
    return gridSolvedCount() >= game.words.length;
  }

  function updateHud() {
    if (!game) return;
    const level = levelMeta[game.levelIndex];
    const solvedCount = gridSolvedCount();
    const total = game.words.length;
    const attemptsTotal = C.ATTEMPTS_PER_LEVEL;

    el.levelTitle.textContent = level.title + ' из ' + levelMeta.length;
    el.levelStats.textContent = solvedCount + ' из ' + total + ' слов · попытки '
      + game.attemptsLeft + ' из ' + attemptsTotal;

    const percent = total ? Math.round((solvedCount / total) * 100) : 0;
    el.levelBar.style.width = percent + '%';
    el.levelBarWrap.setAttribute('aria-valuenow', String(solvedCount));
    el.levelBarWrap.setAttribute('aria-valuemax', String(total));

    el.hintsLeft.textContent = String(game.hintsLeft);
    el.btnHint.disabled = game.hintsLeft <= 0;
  }

  /* ---------------------------------------------------------- геометрия */

  function fitBoard() {
    if (!game || !game.prepared.board.width) return;

    const board = game.prepared.board;
    const gap = 2;
    const rect = el.boardPanel.getBoundingClientRect();
    const fallback = Math.min(window.innerHeight * 0.42, 420);
    const availableWidth = Math.max(140, rect.width - 6);
    const panelHeight = rect.height > 60 ? rect.height : fallback;
    const availableHeight = Math.max(80, panelHeight - 6);

    const byWidth = (availableWidth - (board.width - 1) * gap) / board.width;
    const byHeight = (availableHeight - (board.height - 1) * gap) / board.height;
    const size = clamp(Math.floor(Math.min(byWidth, byHeight)), 14, 46);

    document.documentElement.style.setProperty('--cell', size + 'px');
  }

  /* ------------------------------------------------------------ выделение */

  function isFixed(key) {
    const state = game.cellState.get(key);
    return Boolean(state && state.fixed);
  }

  function selectWord(wordId, index) {
    if (!game) return;

    if (wordId == null) {
      game.activeId = null;
      el.board.focus({ preventScroll: true });
      syncSelection();
      return;
    }

    const word = game.wordsById.get(wordId);
    if (!word) return;

    game.activeId = wordId;
    game.activeIndex = clamp(index || 0, 0, word.cells.length - 1);
    game.direction = word.horizontal ? 'across' : 'down';

    syncSelection();

    if (!word.isGrid) {
      const card = el.extrasList.querySelector('.extra[data-id="' + word.id + '"]');
      if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function onCellClick(key) {
    const board = game.prepared.board;
    const cell = board.cells.get(key);
    if (!cell) return;

    const current = activeWord();
    const wordIds = [cell.across, cell.down].filter(function (id) { return id != null; });
    let targetId = null;

    if (current && current.cells.some(function (item) { return item.key === key; })) {
      const otherId = wordIds.find(function (id) { return id !== current.id; });
      targetId = otherId != null ? otherId : current.id;
    } else {
      targetId = (game.direction === 'across' ? cell.across : cell.down) || cell.across || cell.down;
    }

    const word = game.wordsById.get(targetId);
    if (!word) return;
    const index = word.cells.findIndex(function (item) { return item.key === key; });
    selectWord(targetId, index === -1 ? 0 : index);
  }

  function switchDirection(direction) {
    if (!game) return;

    const key = activeKey();
    const cell = key && game.prepared.board.cells ? game.prepared.board.cells.get(key) : null;
    const targetId = cell ? (direction === 'across' ? cell.across : cell.down) : null;

    if (targetId != null) {
      const word = game.wordsById.get(targetId);
      const index = word.cells.findIndex(function (item) { return item.key === key; });
      selectWord(targetId, index === -1 ? 0 : index);
      return;
    }

    const candidate = game.words.find(function (word) {
      return word.isGrid
        && (direction === 'across') === word.horizontal
        && !game.solved.has(word.id);
    });

    if (candidate) {
      selectWord(candidate.id, 0);
    } else {
      game.direction = direction;
      syncDirectionTabs();
    }
  }

  function firstUnsolvedWord() {
    if (!game) return null;
    return game.words.find(function (word) {
      return !game.solved.has(word.id);
    }) || null;
  }

  function nextUnsolvedWord(fromId) {
    if (!game) return null;
    const index = game.words.findIndex(function (word) { return word.id === fromId; });
    const count = game.words.length;
    for (let step = 1; step <= count; step += 1) {
      const candidate = game.words[(index + step) % count];
      if (!game.solved.has(candidate.id)) return candidate;
    }
    return null;
  }

  /* ------------------------------------------------------------- ввод */

  function wordText(word) {
    return word.cells.map(function (cell) {
      const state = game.cellState.get(cell.key);
      return state && state.ch ? state.ch : ' ';
    }).join('');
  }

  function isWordFilled(word) {
    return word.cells.every(function (cell) {
      const state = game.cellState.get(cell.key);
      return state && state.ch;
    });
  }

  function nextEditableIndex(word, fromIndex) {
    for (let index = fromIndex + 1; index < word.cells.length; index += 1) {
      if (!isFixed(word.cells[index].key)) return index;
    }
    return -1;
  }

  function typeChar(character) {
    const word = activeWord();
    if (!word) {
      showToast('Сначала выбери слово в сетке');
      return;
    }
    if (game.solved.has(word.id)) {
      const next = nextUnsolvedWord(word.id);
      if (next) selectWord(next.id, 0);
      return;
    }

    let index = game.activeIndex;
    while (index < word.cells.length && isFixed(word.cells[index].key)) index += 1;
    if (index >= word.cells.length) return;

    const key = word.cells[index].key;
    const state = game.cellState.get(key);
    if (!state) return;

    state.ch = character;
    state.wrong = false;
    paintCell(key);

    const next = nextEditableIndex(word, index);
    if (next === -1) {
      game.activeIndex = index;
      checkWord(word, { auto: true });
    } else {
      game.activeIndex = next;
      syncSelection();
    }
  }

  function eraseBack() {
    const word = activeWord();
    if (!word) return;
    if (game.solved.has(word.id)) return;

    let index = game.activeIndex;
    const currentState = game.cellState.get(word.cells[index].key);

    if (currentState && currentState.ch && !currentState.fixed) {
      currentState.ch = '';
      currentState.wrong = false;
      paintCell(word.cells[index].key);
      return;
    }

    let previous = index - 1;
    while (previous >= 0 && isFixed(word.cells[previous].key)) previous -= 1;
    if (previous < 0) return;

    const state = game.cellState.get(word.cells[previous].key);
    if (state && !state.fixed) {
      state.ch = '';
      state.wrong = false;
      paintCell(word.cells[previous].key);
    }
    game.activeIndex = previous;
    syncSelection();
  }

  function clearWord() {
    const word = activeWord();
    if (!word) {
      showToast('Сначала выбери слово');
      return;
    }
    if (game.solved.has(word.id)) {
      showToast('Слово уже разгадано');
      return;
    }

    let cleared = false;
    word.cells.forEach(function (cell) {
      const state = game.cellState.get(cell.key);
      if (state && !state.fixed && state.ch) {
        state.ch = '';
        state.wrong = false;
        cleared = true;
        paintCell(cell.key);
      }
    });

    game.activeIndex = 0;
    syncSelection();
    if (cleared) showToast('Слово очищено');
  }

  function moveInWord(delta, axis) {
    const word = activeWord();
    if (!word) return;

    const wordAxis = word.isGrid ? (word.horizontal ? 'across' : 'down') : 'across';

    if (wordAxis !== axis && word.isGrid) {
      const key = activeKey();
      const cell = key ? game.prepared.board.cells.get(key) : null;
      const targetId = cell ? (axis === 'across' ? cell.across : cell.down) : null;
      if (targetId != null) {
        const target = game.wordsById.get(targetId);
        const index = target.cells.findIndex(function (item) { return item.key === key; });
        selectWord(targetId, index === -1 ? 0 : index);
        return;
      }
    }

    const nextIndex = clamp(game.activeIndex + delta, 0, word.cells.length - 1);
    game.activeIndex = nextIndex;
    syncSelection();
  }

  function focusNextWord(backwards) {
    if (!game) return;
    const current = activeWord();
    const list = game.words;
    if (!list.length) return;

    let index = current ? list.findIndex(function (word) { return word.id === current.id; }) : -1;
    const step = backwards ? -1 : 1;

    for (let attempt = 0; attempt < list.length; attempt += 1) {
      index = (index + step + list.length) % list.length;
      const candidate = list[index];
      if (!game.solved.has(candidate.id)) {
        selectWord(candidate.id, 0);
        return;
      }
    }
  }

  /* ------------------------------------------------------------ проверка */

  function checkWord(word, options) {
    if (!word || !game) return false;
    if (game.solved.has(word.id)) return true;

    if (!isWordFilled(word)) {
      if (!options || !options.auto) showToast('Заполни все клетки слова');
      return false;
    }

    const normalized = C.normalizeAnswer(wordText(word));
    const isCorrect = normalized === word.text || word.accepted.indexOf(normalized) !== -1;

    if (isCorrect) {
      markSolved(word);
      return true;
    }

    markWrong(word);

    if (word.isGrid && game.attemptsLeft > 0) {
      game.attemptsLeft -= 1;
      saveGame();
      updateHud();
    }

    if (!options || !options.auto) {
      showToast('Ошибка. Осталось попыток: ' + game.attemptsLeft, true);
    }

    if (word.isGrid && game.attemptsLeft <= 0) {
      showAttemptsBanner();
    }

    return false;
  }

  function markWrong(word) {
    const keys = [];
    word.cells.forEach(function (cell) {
      const state = game.cellState.get(cell.key);
      if (!state || state.fixed) return;
      state.wrong = true;
      keys.push(cell.key);
      paintCell(cell.key);
    });

    if (!keys.length) return;

    window.setTimeout(function () {
      if (!game) return;
      keys.forEach(function (key) {
        const state = game.cellState.get(key);
        if (!state) return;
        state.wrong = false;
        paintCell(key);
      });
    }, 950);
  }

  function markSolved(word) {
    game.solved.add(word.id);

    word.cells.forEach(function (cell, index) {
      const state = game.cellState.get(cell.key);
      if (!state) return;
      state.ch = word.text[index];
      state.fixed = true;
      state.solved = true;
      state.hinted = false;
      state.wrong = false;
      paintCell(cell.key);
    });

    playTone(660, 0.09);
    updateHud();
    saveGame();

    // Пересечения могли автоматически сложить соседнее слово.
    resolveFilledWords();

    if (isLevelComplete()) {
      finishLevel();
      return;
    }

    const next = nextUnsolvedWord(word.id);
    if (next) {
      selectWord(next.id, 0);
      showToast('Верно! Дальше — «' + shorten(next.question) + '»');
    } else {
      syncSelection();
    }
  }

  function shorten(text) {
    const value = String(text);
    return value.length > 48 ? value.slice(0, 45) + '…' : value;
  }

  function resolveFilledWords() {
    if (!game) return;
    let changed = true;

    while (changed) {
      changed = false;
      const candidate = game.words.find(function (word) {
        if (game.solved.has(word.id)) return false;
        if (!isWordFilled(word)) return false;
        const normalized = C.normalizeAnswer(wordText(word));
        return normalized === word.text || word.accepted.indexOf(normalized) !== -1;
      });

      if (candidate) {
        markSolvedSilently(candidate);
        changed = true;
      }
    }
  }

  function markSolvedSilently(word) {
    game.solved.add(word.id);
    word.cells.forEach(function (cell, index) {
      const state = game.cellState.get(cell.key);
      if (!state) return;
      state.ch = word.text[index];
      state.fixed = true;
      state.solved = true;
      state.hinted = false;
      state.wrong = false;
      paintCell(cell.key);
    });
    updateHud();
    saveGame();
  }

  function checkCurrent() {
    const word = activeWord();
    if (!word) {
      showToast('Сначала выбери слово');
      return;
    }
    checkWord(word, { auto: false });
  }

  /* ------------------------------------------------------------ подсказки */

  function useHint() {
    const word = activeWord();
    if (!word) {
      showToast('Сначала выбери слово');
      return;
    }
    if (game.solved.has(word.id)) {
      showToast('Это слово уже разгадано');
      return;
    }
    if (game.hintsLeft <= 0) {
      showToast('Подсказки на этот уровень закончились', true);
      return;
    }

    // У некоторых вопросов подсказка — отдельная плашка с текстом.
    if (word.specialHint && !game.hintPlateShown.has(word.id)) {
      game.hintPlateShown.add(word.id);
      game.hintsLeft -= 1;
      game.hintsUsed += 1;
      updateHud();
      saveGame();
      playTone(520, 0.08);
      el.hintText.textContent = word.specialHint;
      openModal(el.modalHint);
      return;
    }

    if (isWordFilled(word)) {
      const solved = checkWord(word, { auto: true });
      if (solved) return;
    }

    const revealed = game.revealed[word.id] || [];
    const openable = word.cells
      .map(function (cell, index) { return { cell: cell, index: index }; })
      .filter(function (item) {
        return revealed.indexOf(item.index) === -1 && !isFixed(item.cell.key);
      });

    if (openable.length === 0) {
      showToast('В этом слове уже открыты все буквы');
      return;
    }

    if (revealed.length >= 2 || openable.length <= 1) {
      revealWholeWord(word);
      return;
    }

    const target = openable[0];
    const state = game.cellState.get(target.cell.key);
    state.ch = word.text[target.index];
    state.fixed = true;
    state.hinted = true;
    state.wrong = false;
    paintCell(target.cell.key);

    revealed.push(target.index);
    game.revealed[word.id] = revealed;

    game.hintsLeft -= 1;
    game.hintsUsed += 1;

    playTone(520, 0.08);
    updateHud();
    saveGame();
    syncSelection();
    showToast('Открыта буква в слове ' + (word.isGrid ? '№' + word.number : 'без сетки'));

    resolveFilledWords();
    if (isLevelComplete()) {
      finishLevel();
      return;
    }

    if (isWordFilled(word)) checkWord(word, { auto: true });
  }

  function revealWholeWord(word) {
    if (game.hintsLeft <= 0) {
      showToast('Подсказки на этот уровень закончились', true);
      return;
    }

    game.hintsLeft -= 1;
    game.hintsUsed += 1;
    markSolved(word);

    playTone(440, 0.12);
    showToast('Слово открыто целиком');
    saveGame();
  }

  /* ------------------------------------------------------- прогресс */

  function saveGame() {
    if (!game) return;

    const entry = ensureLevelProgress(game.prepared.id);
    entry.solved = Array.from(game.solved);
    entry.revealed = game.revealed;
    entry.hintsLeft = game.hintsLeft;
    entry.hintsUsed = game.hintsUsed;
    entry.attemptsLeft = game.attemptsLeft;

    progress.currentLevel = game.levelIndex;
    progress.totalSolved = countSolvedTotal();
    Store.save(progress);
  }

  function finishLevel() {
    if (!game) return;

    const entry = ensureLevelProgress(game.prepared.id);
    const wasCompleted = entry.completed;
    entry.completed = true;
    saveGame();

    if (!wasCompleted) {
      Platform.saveCloud({ progress: JSON.stringify(progress) });
    }

    const isLast = game.levelIndex >= levelMeta.length - 1;
    const level = levelMeta[game.levelIndex];

    el.doneEyebrow.textContent = isLast ? 'Все уровни пройдены!' : 'Уровень пройден!';
    el.doneTitle.textContent = level.title;
    el.doneWords.textContent = gridSolvedCount() + ' из ' + game.words.length;
    el.doneHints.textContent = String(game.hintsUsed);

    el.btnNextLevel.hidden = isLast;
    el.btnNextLevel.textContent = 'Следующий уровень';

    if (isLast) {
      el.btnDoneMenu.textContent = 'В меню';
    }

    openModal(el.modalDone);
    playTone(880, 0.16);

    Ads.showInterstitial();
  }

  /* --------------------------------------------------------------- судоку */

  function showAttemptsBanner() {
    if (!el.modalAttempts) return;
    openModal(el.modalAttempts);
  }

  function openSudoku() {
    if (!el.screenSudoku || !el.sudokuBoard) return;

    // Каждый раз новая судоку, но не та же, что в прошлый раз.
    let puzzleIndex = Math.floor(Math.random() * SUDOKU_PUZZLES.length);
    if (SUDOKU_PUZZLES.length > 1 && puzzleIndex === lastSudokuIndex) {
      puzzleIndex = (puzzleIndex + 1 + Math.floor(Math.random() * (SUDOKU_PUZZLES.length - 1)))
        % SUDOKU_PUZZLES.length;
    }
    lastSudokuIndex = puzzleIndex;
    const puzzle = SUDOKU_PUZZLES[puzzleIndex];

    sudokuState = {
      puzzle: puzzle,
      values: puzzle.givens.map(function (row) { return row.slice(); }),
      selected: null,
      solved: false,
      wrong: []
    };

    el.screenStart.hidden = true;
    el.screenGame.hidden = true;
    el.screenSudoku.hidden = false;

    setSudokuStatus('Заполните пустые клетки и нажмите «Проверить».', '');
    renderSudoku();
    Platform.gameplayStop();
  }

  function closeSudoku() {
    if (!el.screenSudoku) return;
    el.screenSudoku.hidden = true;
    el.screenGame.hidden = false;
    sudokuState = null;
    requestAnimationFrame(fitBoard);
    Platform.gameplayStart();
  }

  function buildSudokuKeys() {
    if (!el.sudokuKeys) return;
    el.sudokuKeys.innerHTML = '';

    for (let digit = 1; digit <= 4; digit += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sudoku__key';
      button.dataset.digit = String(digit);
      button.textContent = String(digit);
      button.setAttribute('aria-label', 'Цифра ' + digit);
      button.addEventListener('click', function () { sudokuSet(digit); });
      el.sudokuKeys.appendChild(button);
    }

    const erase = document.createElement('button');
    erase.type = 'button';
    erase.className = 'sudoku__key sudoku__key--wide';
    erase.textContent = 'Стереть';
    erase.setAttribute('aria-label', 'Стереть цифру');
    erase.addEventListener('click', function () { sudokuSet(0); });
    el.sudokuKeys.appendChild(erase);
  }

  function renderSudoku() {
    if (!sudokuState || !el.sudokuBoard) return;
    el.sudokuBoard.innerHTML = '';

    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const value = sudokuState.values[row][col];
        const given = sudokuState.puzzle.givens[row][col] !== 0;
        const cell = document.createElement('button');

        cell.type = 'button';
        cell.className = 'sudoku__cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);

        if (given) cell.classList.add('sudoku__cell--given');
        if (value) cell.textContent = String(value);

        if (sudokuState.selected && sudokuState.selected.row === row
          && sudokuState.selected.col === col) {
          cell.classList.add('sudoku__cell--selected');
        }

        if (sudokuState.wrong.some(function (item) {
          return item.row === row && item.col === col;
        })) {
          cell.classList.add('sudoku__cell--wrong');
        }

        if (col === 1) cell.classList.add('sudoku__cell--br');
        if (row === 1) cell.classList.add('sudoku__cell--bb');

        cell.setAttribute('aria-label', 'Строка ' + (row + 1) + ', столбец ' + (col + 1)
          + (value ? ', цифра ' + value : ', пусто') + (given ? ', нельзя менять' : ''));

        cell.addEventListener('click', function () {
          if (!sudokuState) return;
          sudokuState.selected = { row: row, col: col };
          renderSudoku();
        });

        el.sudokuBoard.appendChild(cell);
      }
    }
  }

  function sudokuSet(value) {
    if (!sudokuState || sudokuState.solved || !sudokuState.selected) return;

    const row = sudokuState.selected.row;
    const col = sudokuState.selected.col;
    if (sudokuState.puzzle.givens[row][col] !== 0) return;

    sudokuState.values[row][col] = value;
    sudokuState.wrong = [];
    setSudokuStatus('', '');
    renderSudoku();
  }

  function setSudokuStatus(text, kind) {
    if (!el.sudokuStatus) return;
    el.sudokuStatus.textContent = text;
    el.sudokuStatus.classList.toggle('is-error', kind === 'error');
    el.sudokuStatus.classList.toggle('is-ok', kind === 'ok');
  }

  function checkSudoku() {
    if (!sudokuState || sudokuState.solved) return;

    const wrong = [];
    let empty = 0;

    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const value = sudokuState.values[row][col];
        if (!value) {
          empty += 1;
          continue;
        }
        if (value !== sudokuState.puzzle.solution[row][col]) {
          wrong.push({ row: row, col: col });
        }
      }
    }

    if (empty > 0) {
      sudokuState.wrong = [];
      renderSudoku();
      setSudokuStatus('Заполните все пустые клетки.', 'error');
      return;
    }

    if (wrong.length) {
      sudokuState.wrong = wrong;
      renderSudoku();
      setSudokuStatus('Пока не сходится. Проверьте выделенные клетки.', 'error');
      return;
    }

    sudokuState.solved = true;
    renderSudoku();
    setSudokuStatus('Судоку собрана! Возвращаемся к кроссворду…', 'ok');
    playTone(880, 0.14);

    if (game) {
      game.attemptsLeft = C.ATTEMPTS_PER_LEVEL;
      saveGame();
      updateHud();
    }

    window.setTimeout(function () {
      closeSudoku();
      showToast('Попытки восстановлены: ' + C.ATTEMPTS_PER_LEVEL);
    }, 1100);
  }

  /* ------------------------------------------------------------ клавиатура */

  function buildKeyboard() {
    el.keyboard.innerHTML = '';
    const rows = [];

    KEYBOARD_ROWS.forEach(function (row) {
      rows.push(row.split(''));
    });

    rows.forEach(function (keys, rowIndex) {
      const row = document.createElement('div');
      row.className = 'kb-row';

      keys.forEach(function (character) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kb-key';
        button.dataset.char = character;
        button.textContent = character;
        button.setAttribute('aria-label', 'Буква ' + character);
        button.addEventListener('click', function () { typeChar(character); });
        row.appendChild(button);
      });

      if (rowIndex === rows.length - 1) {
        const erase = document.createElement('button');
        erase.type = 'button';
        erase.className = 'kb-key kb-key--wide';
        erase.textContent = 'Стереть';
        erase.setAttribute('aria-label', 'Стереть букву');
        erase.addEventListener('click', eraseBack);
        row.appendChild(erase);
      }

      el.keyboard.appendChild(row);
    });

    const digitRow = document.createElement('div');
    digitRow.className = 'kb-row kb-row--digits';
    DIGITS.split('').forEach(function (digit) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kb-key kb-key--digits';
      button.textContent = digit;
      button.addEventListener('click', function () { typeChar(digit); });
      digitRow.appendChild(button);
    });
    el.keyboard.appendChild(digitRow);
  }

  function updateDigitRow() {
    const word = activeWord();
    const needsDigits = Boolean(word && /[0-9]/.test(word.text));
    el.keyboard.classList.toggle('kb--digits', needsDigits);
  }

  /* ------------------------------------------------------------ события */

  function bindEvents() {
    el.btnPlay.addEventListener('click', function () {
      const index = clamp(progress.currentLevel, 0, levelMeta.length - 1);
      startLevel(isLevelUnlocked(index) ? index : 0);
    });

    el.btnHowto.addEventListener('click', function () { openModal(el.modalHowto); });
    el.btnHowto2.addEventListener('click', function () {
      closeModal(el.modalMenu);
      openModal(el.modalHowto);
    });
    el.btnHowtoClose.addEventListener('click', function () { closeModal(el.modalHowto); });
    el.btnHowtoOk.addEventListener('click', function () { closeModal(el.modalHowto); });

    el.btnHintClose.addEventListener('click', function () { closeModal(el.modalHint); });
    el.btnHintOk.addEventListener('click', function () { closeModal(el.modalHint); });

    el.btnAttemptsSudoku.addEventListener('click', function () {
      closeModal(el.modalAttempts);
      openSudoku();
    });

    el.extrasToggle.addEventListener('click', function () {
      var open = el.extras.classList.toggle('is-open');
      el.extrasToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      requestAnimationFrame(fitBoard);
    });


    el.btnMenu.addEventListener('click', function () {
      if (el.screenGame.hidden) return;
      renderLevelList();
      openModal(el.modalMenu);
    });
    el.btnMenuClose.addEventListener('click', function () { closeModal(el.modalMenu); });
    el.btnResume.addEventListener('click', function () { closeModal(el.modalMenu); });

    el.btnSound.addEventListener('click', function () {
      progress.settings.sound = !progress.settings.sound;
      Store.save(progress);
      updateSoundUi();
      if (progress.settings.sound) playTone(520, 0.08);
    });

    el.btnReset.addEventListener('click', function () {
      closeModal(el.modalMenu);
      openModal(el.modalConfirm);
    });

    el.btnConfirmNo.addEventListener('click', function () {
      closeModal(el.modalConfirm);
      openModal(el.modalMenu);
    });

    el.btnConfirmYes.addEventListener('click', function () {
      Store.reset();
      progress = Store.emptyProgress();
      preparedCache.clear();
      game = null;
      closeAllModals();
      el.screenGame.hidden = true;
      el.screenStart.hidden = false;
      renderStartScreen();
      showToast('Прогресс сброшен');
    });

    el.btnCheck.addEventListener('click', checkCurrent);
    el.btnSudokuCheck.addEventListener('click', checkSudoku);
    el.btnHint.addEventListener('click', useHint);
    el.btnClear.addEventListener('click', clearWord);

    el.dirAcross.addEventListener('click', function () { switchDirection('across'); });
    el.dirDown.addEventListener('click', function () { switchDirection('down'); });

    el.btnNextLevel.addEventListener('click', function () {
      closeModal(el.modalDone);
      startLevel(clamp(game.levelIndex + 1, 0, levelMeta.length - 1));
    });

    el.btnDoneMenu.addEventListener('click', function () {
      closeModal(el.modalDone);
      renderStartScreen();
      el.screenGame.hidden = true;
      el.screenStart.hidden = false;
    });

    document.querySelectorAll('[data-close]').forEach(function (node) {
      node.addEventListener('click', function () {
        const name = node.dataset.close;
        if (name === 'menu') closeModal(el.modalMenu);
        if (name === 'howto') closeModal(el.modalHowto);
        if (name === 'hint') closeModal(el.modalHint);
        if (name === 'confirm') {
          closeModal(el.modalConfirm);
          if (!el.screenGame.hidden) openModal(el.modalMenu);
        }
      });
    });

    document.addEventListener('keydown', onKeyDown);

    window.addEventListener('resize', fitBoard);
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(function () { fitBoard(); });
      observer.observe(el.boardPanel);
    }
  }

  function renderLevelList() {
    el.levelList.innerHTML = '';

    levelMeta.forEach(function (level, index) {
      const entry = progress.levels[level.id];
      const solved = entry ? entry.solved.length : 0;
      const unlocked = isLevelUnlocked(index);
      const done = Boolean(entry && entry.completed);

      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-item' + (game && game.levelIndex === index ? ' is-current' : '');
      button.disabled = !unlocked;

      const number = document.createElement('span');
      number.className = 'level-item__index';
      number.textContent = String(index + 1);

      const title = document.createElement('span');
      title.className = 'level-item__title';
      title.textContent = level.title;

      const state = document.createElement('span');
      state.className = 'level-item__state' + (done ? ' is-done' : '');
      if (!unlocked) state.textContent = 'закрыт';
      else if (done) state.textContent = 'пройден';
      else state.textContent = solved + ' из ' + level.questions.length;

      button.appendChild(number);
      button.appendChild(title);
      button.appendChild(state);

      button.addEventListener('click', function () {
        if (!unlocked) return;
        closeModal(el.modalMenu);
        startLevel(index);
      });

      item.appendChild(button);
      el.levelList.appendChild(item);
    });
  }

  function updateSoundUi() {
    const enabled = Boolean(progress.settings && progress.settings.sound);
    el.btnSound.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    el.soundLabel.textContent = enabled ? 'Звук: включён' : 'Звук: выключен';
  }

  function onKeyDown(event) {
    if (event.defaultPrevented) return;

    if (el.screenSudoku && !el.screenSudoku.hidden) {
      const sudokuKey = event.key;
      if (/^[1-4]$/.test(sudokuKey)) {
        event.preventDefault();
        sudokuSet(Number(sudokuKey));
      } else if (sudokuKey === 'Backspace' || sudokuKey === 'Delete') {
        event.preventDefault();
        sudokuSet(0);
      } else if (sudokuKey === 'Enter') {
        event.preventDefault();
        checkSudoku();
      }
      return;
    }

    if (event.key === 'Escape') {
      if (!el.modalAttempts.hidden) return;
      if (!el.modalHint.hidden) { closeModal(el.modalHint); return; }
      if (!el.modalConfirm.hidden) { closeModal(el.modalConfirm); return; }
      if (!el.modalHowto.hidden) { closeModal(el.modalHowto); return; }
      if (!el.modalDone.hidden) { closeModal(el.modalDone); return; }
      if (!el.modalMenu.hidden) { closeModal(el.modalMenu); return; }
      if (!el.screenGame.hidden && game) {
        renderLevelList();
        openModal(el.modalMenu);
        return;
      }
    }

    if (anyModalOpen()) return;
    if (el.screenGame.hidden || !game) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;

    if (key.length === 1) {
      const character = key.toUpperCase();
      if (/^[А-ЯЁA-Z0-9]$/.test(character)) {
        event.preventDefault();
        typeChar(character);
        updateDigitRow();
      }
      return;
    }

    switch (key) {
      case 'Backspace':
        event.preventDefault();
        eraseBack();
        break;
      case 'Delete':
        event.preventDefault();
        clearWord();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveInWord(-1, 'across');
        break;
      case 'ArrowRight':
        event.preventDefault();
        moveInWord(1, 'across');
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveInWord(-1, 'down');
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveInWord(1, 'down');
        break;
      case 'Tab':
        event.preventDefault();
        focusNextWord(event.shiftKey);
        break;
      case 'Enter':
        event.preventDefault();
        checkCurrent();
        break;
      default:
        break;
    }
  }

  // Небольшой API для админ-панели и отладочных страниц.
  window.GameApp = {
    startLevel: function (index) { startLevel(index); },
    levelTitles: function () {
      return levelMeta.map(function (level) { return level.title; });
    },
    isPlaying: function () { return Boolean(game); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
