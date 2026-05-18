/* ============================================================
   TradeScope — ページトランジション & セクションリビール
   assets/transitions.js

   ┌─ VT 対応ブラウザ (Chrome 126+ / Safari 18.2+) ──────────────
   │  @view-transition { navigation: auto } が CSS でトランジションを処理。
   │  初回ロード時のみセクションのスタッガーリビールを実行。
   │  VT ナビゲーション時はスキップ（VT がスムーズさを保証するため）。
   └─ 非VT ブラウザ ─────────────────────────────────────────────
      フェードアウト → ナビゲーション → フェードイン で対応。
      IntersectionObserver でスクロールリビールも実行。
============================================================ */
(function () {
  'use strict';

  /* 同一ページへのリンククリックは再読込しない */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var url;
    try { url = new URL(link.href, location.href); } catch (ex) { return; }
    if (url.origin !== location.origin) return;

    var samePath = (url.pathname === location.pathname && url.search === location.search);
    var hashOnlyMove = (samePath && url.hash && url.hash !== location.hash);
    if (hashOnlyMove) return;

    if (samePath) {
      e.preventDefault();
    }
  }, true);

  /* ── クロスドキュメント VT のサポート検出 ── */
  /* 'onpageswap' は cross-document VT 対応ブラウザにのみ存在 */
  var hasCrossDocVT = ('onpageswap' in window);

  /* ──────────────────────────────────────
     非VT ブラウザ: フェードアウト/イン フォールバック
  ────────────────────────────────────── */
  if (!hasCrossDocVT) {
    document.documentElement.classList.add('no-vt');

    /* 内部リンクのクリックをインターセプトしてフェードアウト */
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href]');
      if (!link) return;
      var url;
      try { url = new URL(link.href, location.href); } catch (ex) { return; }
      /* 外部リンク・同一ページは除外 */
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      document.body.classList.add('page-exit');
      var dest = link.href;
      setTimeout(function () { location.href = dest; }, 185);
    }, true);
  }

  /* ──────────────────────────────────────
     セクション リビール
     IntersectionObserver + 初期ビューポート スタッガー
  ────────────────────────────────────── */
  function doReveal() {
    var baseItems = Array.from(document.querySelectorAll('.section.glass, .chart-area'));
    var items = [];
    var seen = new Set();

    baseItems.forEach(function (el) {
      var childSelector = el.dataset.revealChildren;
      if (childSelector) {
        var children = Array.from(el.querySelectorAll(childSelector));
        if (children.length) {
          children.forEach(function (child) {
            if (seen.has(child)) return;
            seen.add(child);
            items.push(child);
          });
          return;
        }
      }
      if (seen.has(el)) return;
      seen.add(el);
      items.push(el);
    });

    if (!items.length) return;

    function parseMsValue(value, fallback) {
      if (value == null || value === '') return fallback;
      var n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }

    function applyRevealVars(el, index, isInitialViewport) {
      var duration = parseMsValue(el.dataset.revealDuration, 420);
      var explicitDelay = parseMsValue(el.dataset.revealDelay, null);
      var baseDelay = parseMsValue(el.dataset.revealBaseDelay, 20);
      var stagger = parseMsValue(el.dataset.revealStagger, 45);
      var maxDelay = parseMsValue(el.dataset.revealMaxDelay, 180);

      var delay = explicitDelay;
      if (delay == null) {
        delay = isInitialViewport ? Math.min(baseDelay + index * stagger, maxDelay) : 0;
      }

      el.style.setProperty('--reveal-duration', duration + 'ms');
      el.style.setProperty('--reveal-delay', delay + 'ms');
    }

    /*
     * CSS animation（section-reveal）を使用。
     * animation-fill-mode: both により、クラス追加の瞬間に
     * from キーフレーム（opacity: 0）が即座に適用される。
     * transition ベースの逆方向アニメーション問題も発生しない。
     * transform を使わないため Grid 列幅計算にも影響しない。
     */

    /* スクロール圏外の要素を監視 */
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          applyRevealVars(entry.target, 0, false);
          entry.target.classList.add('reveal-anim');
          if (entry.target.dataset.revealRepeat !== 'true') {
            observer.unobserve(entry.target);
          }
        } else if (entry.target.dataset.revealRepeat === 'true') {
          entry.target.classList.remove('reveal-anim');
          entry.target.classList.add('reveal-pending');
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -120px 0px' });

    var vh = window.innerHeight;
    items.forEach(function (el, i) {
      if (el.getBoundingClientRect().top < vh) {
        /* 初期ビューポート内: インデックス順に時差表示（最大 350ms でキャップ）*/
        el.classList.remove('reveal-pending');
        applyRevealVars(el, i, true);
        el.classList.add('reveal-anim');
      } else {
        /* スクロール圏外: Intersection Observer に委譲 */
        el.classList.add('reveal-pending');
        observer.observe(el);
      }
    });
  }

  function initSectionReveals() {
    var splash = document.getElementById('splashScreen');
    if (splash) {
      /* index.html のスプラッシュ消去を MutationObserver で検知してからリビール */
      var mo = new MutationObserver(function () {
        if (!document.getElementById('splashScreen')) {
          mo.disconnect();
          doReveal();
        }
      });
      mo.observe(document.body, { childList: true });
    } else {
      doReveal();
    }
  }

  /* ──────────────────────────────────────
     タイミング制御
     pagereveal (VT 対応) or DOMContentLoaded (非 VT)
  ────────────────────────────────────── */
  if ('onpagereveal' in window) {
    /* VT 対応ブラウザ: 初回/遷移時ともにリビールを実行 */
    window.addEventListener('pagereveal', function () {
      initSectionReveals();
    });
  } else {
    /* 非VT ブラウザ: DOMContentLoaded でリビールを開始 */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSectionReveals);
    } else {
      initSectionReveals();
    }
  }
})();
