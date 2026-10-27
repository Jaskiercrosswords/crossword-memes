/*
 * Сохранение прогресса. Работает только с localStorage и никогда не
 * роняет игру: при запрете хранилища всё живёт в памяти до перезагрузки.
 */
(function (global) {
  'use strict';

  const KEY = 'crossword.memes.v2';
  const VERSION = 2;

  function emptyProgress() {
    return {
      version: VERSION,
      currentLevel: 0,
      totalSolved: 0,
      levels: {},
      settings: { sound: false }
    };
  }

  function isStorageAvailable() {
    try {
      const probe = '__cw_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  }

  let available = isStorageAvailable();
  let memory = emptyProgress();

  function sanitizeLevel(value) {
    const result = {
      solved: [],
      revealed: {},
      hintsLeft: 3,
      hintsUsed: 0,
      attemptsLeft: 4,
      completed: false
    };
    if (!value || typeof value !== 'object') return result;

    if (Array.isArray(value.solved)) {
      result.solved = value.solved.filter(function (id) {
        return Number.isInteger(id);
      });
    }

    if (value.revealed && typeof value.revealed === 'object') {
      Object.keys(value.revealed).forEach(function (key) {
        const id = Number(key);
        if (!Number.isInteger(id) || !Array.isArray(value.revealed[key])) return;
        result.revealed[id] = value.revealed[key].filter(function (index) {
          return Number.isInteger(index) && index >= 0 && index < 40;
        });
      });
    }

    if (Number.isInteger(value.hintsLeft)) {
      result.hintsLeft = Math.max(0, Math.min(3, value.hintsLeft));
    }
    if (Number.isInteger(value.hintsUsed)) {
      result.hintsUsed = Math.max(0, value.hintsUsed);
    }
    if (Number.isInteger(value.attemptsLeft)) {
      result.attemptsLeft = Math.max(0, Math.min(4, value.attemptsLeft));
    }
    result.completed = value.completed === true;
    return result;
  }

  function sanitize(raw) {
    const base = emptyProgress();
    if (!raw || typeof raw !== 'object') return base;

    if (Number.isInteger(raw.currentLevel) && raw.currentLevel >= 0) {
      base.currentLevel = raw.currentLevel;
    }
    if (Number.isInteger(raw.totalSolved) && raw.totalSolved >= 0) {
      base.totalSolved = raw.totalSolved;
    }
    if (raw.levels && typeof raw.levels === 'object') {
      Object.keys(raw.levels).forEach(function (key) {
        base.levels[key] = sanitizeLevel(raw.levels[key]);
      });
    }
    if (raw.settings && typeof raw.settings === 'object') {
      base.settings.sound = raw.settings.sound === true;
    }
    return base;
  }

  function load() {
    if (!available) return sanitize(memory);

    try {
      const raw = global.localStorage.getItem(KEY);
      if (!raw) return emptyProgress();
      memory = sanitize(JSON.parse(raw));
      return memory;
    } catch (error) {
      console.warn('Не удалось прочитать сохранение, начинаем с чистого листа.', error);
      return emptyProgress();
    }
  }

  function save(progress) {
    memory = sanitize(progress);
    if (!available) return false;

    try {
      global.localStorage.setItem(KEY, JSON.stringify(memory));
      return true;
    } catch (error) {
      console.warn('Не удалось сохранить прогресс в localStorage.', error);
      available = false;
      return false;
    }
  }

  function reset() {
    memory = emptyProgress();
    if (!available) return;
    try {
      global.localStorage.removeItem(KEY);
    } catch (error) {
      console.warn('Не удалось очистить сохранение.', error);
    }
  }

  const api = {
    KEY: KEY,
    emptyProgress: emptyProgress,
    load: load,
    save: save,
    reset: reset,
    isAvailable: function () { return available; }
  };

  global.Storage = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
