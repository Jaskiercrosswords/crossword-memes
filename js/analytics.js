/*
 * Яндекс.Метрика — аналитика прохождений.
 *
 * Чтобы включить: впишите номер своего счётчика Метрики в YM_COUNTER_ID
 * ниже (только цифры), сохраните файл и запушьте в GitHub — сайт
 * пересоберётся автоматически.
 *
 * Цели:
 *   level1 … level10  — слово/уровень пройден (по номеру уровня)
 *   all_levels        — прохождение последнего (10-го) уровня, то есть
 *                        «игра пройдена»
 * Цели нужно также создать в интерфейсе Метрики, см. README.
 */
(function (global) {
  'use strict';

  // TODO: впишите сюда номер счётчика Метрики, например 12345678
  const YM_COUNTER_ID = '';

  function enabled() {
    return typeof YM_COUNTER_ID === 'string' && /^\d+$/.test(YM_COUNTER_ID);
  }

  /** Загружает счётчик Метрики, только если задан номер и мы не на localhost. */
  function init() {
    if (!enabled()) return;
    if (!global.location || /localhost|127\.0\.0\.1|file:/.test(global.location.href)) return;

    try {
      const script = global.document.createElement('script');
      script.src = 'https://mc.yandex.ru/metrika/tag.js';
      script.async = true;
      global.document.head.appendChild(script);

      // Задержка, чтобы ym(...) существовал.
      const boot = function () {
        if (typeof global.ym === 'function') {
          global.ym(YM_COUNTER_ID, 'init', {
            clickmap: true,
            trackLinks: true,
            accurateTrackBounce: true,
            webvisor: true
          });
        }
      };
      if (global.document.readyState !== 'loading') boot();
      else global.document.addEventListener('DOMContentLoaded', boot);
    } catch (error) {
      /* не критично для игры */
    }
  }

  /** Отправляет событие-цель (нужно создать цель в Метрике). */
  function trackGoal(name) {
    if (!enabled() || typeof global.ym !== 'function') return;
    try {
      global.ym(YM_COUNTER_ID, 'reachGoal', name);
    } catch (error) {
      /* ignore */
    }
  }

  const api = {
    init: init,
    trackGoal: trackGoal,
    enabled: enabled
  };

  global.Analytics = api;
})(typeof window !== 'undefined' ? window : globalThis);