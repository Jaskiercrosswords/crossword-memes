/*
 * Реклама Яндекс Игр.
 *
 * По умолчанию выключена: сначала нужно выпустить и проверить саму игру.
 * Чтобы включить, поставьте ADS_ENABLED = true и убедитесь, что SDK грузится
 * на платформе. Ни один вызов здесь не должен ломать игровой процесс.
 */
(function (global) {
  'use strict';

  const ADS_ENABLED = false;

  const Ads = {
    enabled: ADS_ENABLED,
    interstitialShown: 0,
    lastInterstitialAt: 0
  };

  function platform() {
    return global.Platform || null;
  }

  function sdk() {
    const p = platform();
    return p && p.sdk ? p.sdk : null;
  }

  function hasAdv() {
    const api = sdk();
    return Boolean(api && api.adv);
  }

  /** Полноэкранная реклама в логичной паузе: между уровнями. */
  Ads.showInterstitial = function showInterstitial() {
    if (!Ads.enabled) {
      return Promise.resolve({ shown: false, reason: 'disabled' });
    }
    if (!hasAdv() || typeof sdk().adv.showFullscreenAdv !== 'function') {
      return Promise.resolve({ shown: false, reason: 'no-adv' });
    }

    // Не чаще одного раза в 60 секунд даже при частых переходах.
    const now = Date.now();
    if (now - Ads.lastInterstitialAt < 60000) {
      return Promise.resolve({ shown: false, reason: 'too-often' });
    }

    return new Promise(function (resolve) {
      let settled = false;
      const finish = function (result) {
        if (settled) return;
        settled = true;
        Ads.lastInterstitialAt = Date.now();
        resolve(result);
      };

      try {
        sdk().adv.showFullscreenAdv({
          callbacks: {
            onOpen: function () {
              Ads.interstitialShown += 1;
            },
            onClose: function (wasShown) {
              finish({ shown: Boolean(wasShown), reason: 'closed' });
            },
            onError: function (error) {
              console.warn('Ошибка полноэкранной рекламы.', error);
              finish({ shown: false, reason: 'error' });
            }
          }
        });
      } catch (error) {
        console.warn('Не удалось показать полноэкранную рекламу.', error);
        finish({ shown: false, reason: 'exception' });
      }
    });
  };

  /**
   * Реклама за награду. Награда выдаётся только в onRewarded, как требует
   * документация; при ошибке или закрытии без просмотра — не выдаётся.
   */
  Ads.showRewarded = function showRewarded() {
    if (!Ads.enabled) {
      return Promise.resolve({ rewarded: false, reason: 'disabled' });
    }
    if (!hasAdv() || typeof sdk().adv.showRewardedVideo !== 'function') {
      return Promise.resolve({ rewarded: false, reason: 'no-adv' });
    }

    return new Promise(function (resolve) {
      let rewarded = false;
      let settled = false;
      const finish = function (result) {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      try {
        sdk().adv.showRewardedVideo({
          callbacks: {
            onOpen: function () {},
            onRewarded: function () {
              rewarded = true;
            },
            onClose: function () {
              finish({ rewarded: rewarded, reason: 'closed' });
            },
            onError: function (error) {
              console.warn('Ошибка рекламы за награду.', error);
              finish({ rewarded: false, reason: 'error' });
            }
          }
        });
      } catch (error) {
        console.warn('Не удалось показать рекламу за награду.', error);
        finish({ rewarded: false, reason: 'exception' });
      }
    });
  };

  global.Ads = Ads;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Ads;
  }
})(typeof window !== 'undefined' ? window : globalThis);
