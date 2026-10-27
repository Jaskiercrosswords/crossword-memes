/*
 * Мост к SDK Яндекс Игр.
 *
 * Задача модуля — не дать игре упасть, если SDK нет: локально, в предпросмотре
 * или при медленной сети. Все методы безопасны и возвращают null/undefined,
 * если платформа недоступна.
 */
(function (global) {
  'use strict';

  const SDK_PATH = '/sdk.js';

  const Platform = {
    sdk: null,
    player: null,
    ready: false,
    cloudAvailable: false
  };

  function isYandexHost() {
    const host = global.location ? global.location.hostname : '';
    if (!host) return false;
    return /(^|\.)yandex\.(ru|net|com|by|kz|ua)$/i.test(host)
      || /(^|\.)games\.s3\.yandex\.net$/i.test(host)
      || host === 'app-'.concat('ya.ru');
  }

  function loadSdkScript() {
    return new Promise(function (resolve) {
      if (global.YaGames) {
        resolve(true);
        return;
      }

      const script = global.document.createElement('script');
      script.src = SDK_PATH;
      script.async = true;
      script.onload = function () {
        resolve(Boolean(global.YaGames));
      };
      script.onerror = function () {
        // Локальный запуск: SDK нет, игра продолжает работать без него.
        resolve(false);
      };
      global.document.head.appendChild(script);
    });
  }

  Platform.init = function init() {
    if (!isYandexHost() || typeof global.YaGames === 'undefined') {
      if (!isYandexHost()) {
        return Promise.resolve(false);
      }
    }

    return loadSdkScript()
      .then(function (loaded) {
        if (!loaded || typeof global.YaGames === 'undefined') return false;
        return global.YaGames.init().then(function (sdk) {
          Platform.sdk = sdk;
          Platform.cloudAvailable = Boolean(
            sdk && sdk.getPlayer && (sdk.features && sdk.features.LoadingAPI)
          );
          return sdk.getPlayer({ scopes: false })
            .then(function (player) {
              Platform.player = player;
              return true;
            })
            .catch(function (error) {
              console.warn('Игрок Яндекс Игр недоступен, работаем без облака.', error);
              return true;
            });
        });
      })
      .catch(function (error) {
        console.warn('SDK Яндекс Игр не инициализировался, работаем локально.', error);
        return false;
      })
      .then(function (result) {
        Platform.ready = result !== false;
        return Platform.ready;
      });
  };

  /** Сообщает платформе, что игра готова принимать игрока. */
  Platform.readyGameplay = function readyGameplay() {
    if (!Platform.sdk) return;
    try {
      const loadingApi = Platform.sdk.features && Platform.sdk.features.LoadingAPI;
      if (loadingApi && typeof loadingApi.ready === 'function') {
        loadingApi.ready();
      }
    } catch (error) {
      console.warn('Не удалось вызвать LoadingAPI.ready().', error);
    }
  };

  /** Пауза игрового процесса для рекламы и меню. */
  Platform.gameplayStart = function gameplayStart() {
    if (!Platform.sdk) return;
    try {
      const gameplay = Platform.sdk.features && Platform.sdk.features.GameplayAPI;
      if (gameplay && typeof gameplay.start === 'function') gameplay.start();
    } catch (error) {
      /* не критично для игры */
    }
  };

  Platform.gameplayStop = function gameplayStop() {
    if (!Platform.sdk) return;
    try {
      const gameplay = Platform.sdk.features && Platform.sdk.features.GameplayAPI;
      if (gameplay && typeof gameplay.stop === 'function') gameplay.stop();
    } catch (error) {
      /* не критично для игры */
    }
  };

  /** Облачное сохранение: используется как дополнение к localStorage. */
  Platform.loadCloud = function loadCloud() {
    if (!Platform.player || typeof Platform.player.getData !== 'function') {
      return Promise.resolve(null);
    }
    return Platform.player.getData().catch(function (error) {
      console.warn('Не удалось прочитать облачное сохранение.', error);
      return null;
    });
  };

  Platform.saveCloud = function saveCloud(payload) {
    if (!Platform.player || typeof Platform.player.setData !== 'function') {
      return Promise.resolve(false);
    }
    return Platform.player.setData(payload)
      .then(function () { return true; })
      .catch(function (error) {
        console.warn('Не удалось записать облачное сохранение.', error);
        return false;
      });
  };

  global.Platform = Platform;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Platform;
  }
})(typeof window !== 'undefined' ? window : globalThis);
