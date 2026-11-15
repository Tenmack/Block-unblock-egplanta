/*
 * Ads: one small wrapper over the ad SDKs of the web game portals.
 *
 * The portal is chosen by <html data-portal="..."> (set by build.sh) or by
 * ?portal=... in the URL. Supported: none, crazygames, poki, gamedistribution.
 *
 * The game only ever calls:
 *   Ads.init(), Ads.loadingDone(), Ads.gameplayStart(), Ads.gameplayStop(),
 *   Ads.midgame()  -> Promise<void>     (interstitial at a natural break)
 *   Ads.rewarded() -> Promise<boolean>  (true = player watched it, give reward)
 *   Ads.hasRewarded                     (false = hide "watch ad" buttons)
 *   Ads.onPause / Ads.onResume          (set by the game: mute + freeze)
 *
 * If an SDK fails to load (ad blocker, offline), everything falls back to the
 * no-ads behaviour so the game keeps working.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var qs = new URLSearchParams(location.search);
  var PORTAL = (qs.get('portal') || root.dataset.portal || 'none').toLowerCase();

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
  }
  function safe(fn) { try { fn(); } catch (e) { /* ignore SDK errors */ } }

  var Ads = {
    portal: PORTAL,
    hasRewarded: false,
    onPause: function () {},
    onResume: function () {},
    init: function () { return Promise.resolve(); },
    loadingDone: function () {},
    gameplayStart: function () {},
    gameplayStop: function () {},
    midgame: function () { return Promise.resolve(); },
    rewarded: function () { return Promise.resolve(false); }
  };
  var noop = Object.assign({}, Ads);
  delete noop.onPause; delete noop.onResume; delete noop.portal; // keep the game's hooks

  function pause() { safe(function () { Ads.onPause(); }); }
  function resume() { safe(function () { Ads.onResume(); }); }

  // --- CrazyGames (SDK v3) -------------------------------------------------
  function crazygames() {
    var sdk;
    return {
      hasRewarded: true,
      init: function () {
        return loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js')
          .then(function () { sdk = window.CrazyGames.SDK; return sdk.init(); })
          .then(function () { safe(function () { sdk.game.loadingStart(); }); });
      },
      loadingDone: function () { safe(function () { sdk.game.loadingStop(); }); },
      gameplayStart: function () { safe(function () { sdk.game.gameplayStart(); }); },
      gameplayStop: function () { safe(function () { sdk.game.gameplayStop(); }); },
      midgame: function () {
        return new Promise(function (res) {
          try {
            sdk.ad.requestAd('midgame', {
              adStarted: pause,
              adFinished: function () { resume(); res(); },
              adError: function () { resume(); res(); }
            });
          } catch (e) { res(); }
        });
      },
      rewarded: function () {
        return new Promise(function (res) {
          try {
            sdk.ad.requestAd('rewarded', {
              adStarted: pause,
              adFinished: function () { resume(); res(true); },
              adError: function () { resume(); res(false); }
            });
          } catch (e) { res(false); }
        });
      }
    };
  }

  // --- Poki (SDK v2) --------------------------------------------------------
  function poki() {
    var P = function () { return window.PokiSDK; };
    return {
      hasRewarded: true,
      init: function () {
        return loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js')
          .then(function () { return P().init(); });
      },
      loadingDone: function () { safe(function () { P().gameLoadingFinished(); }); },
      gameplayStart: function () { safe(function () { P().gameplayStart(); }); },
      gameplayStop: function () { safe(function () { P().gameplayStop(); }); },
      midgame: function () {
        try {
          return P().commercialBreak(pause).then(resume, resume);
        } catch (e) { return Promise.resolve(); }
      },
      rewarded: function () {
        try {
          return P().rewardedBreak(pause).then(function (ok) { resume(); return !!ok; },
            function () { resume(); return false; });
        } catch (e) { return Promise.resolve(false); }
      }
    };
  }

  // --- GameDistribution -----------------------------------------------------
  function gamedistribution() {
    var gameId = root.dataset.gdId || qs.get('gd') || '';
    var watched = false;
    return {
      hasRewarded: true,
      init: function () {
        return new Promise(function (res, rej) {
          window.GD_OPTIONS = {
            gameId: gameId,
            onEvent: function (ev) {
              switch (ev.name) {
                case 'SDK_READY': res(); break;
                case 'SDK_GAME_PAUSE': pause(); break;
                case 'SDK_GAME_START': resume(); break;
                case 'SDK_REWARDED_WATCH_COMPLETE': watched = true; break;
              }
            }
          };
          loadScript('https://html5.api.gamedistribution.com/main.min.js').catch(rej);
        });
      },
      midgame: function () {
        if (!window.gdsdk) return Promise.resolve();
        return Promise.resolve(window.gdsdk.showAd()).then(function () {}, function () {}).then(resume);
      },
      rewarded: function () {
        if (!window.gdsdk) return Promise.resolve(false);
        watched = false;
        return Promise.resolve(window.gdsdk.showAd('rewarded'))
          .then(function () { resume(); return watched; }, function () { resume(); return false; });
      }
    };
  }

  var impls = { crazygames: crazygames, poki: poki, gamedistribution: gamedistribution };
  if (impls[PORTAL]) {
    var impl = impls[PORTAL]();
    var realInit = impl.init;
    Object.assign(Ads, impl);
    Ads.init = function () {
      return withTimeout(realInit(), 8000).catch(function () {
        // SDK blocked or unavailable: carry on without ads.
        Object.assign(Ads, noop, { portal: PORTAL + ' (offline)' });
      });
    };
  }

  window.Ads = Ads;
})();
