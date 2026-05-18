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
    var items = Array.from(document.querySelectorAll('.section.glass'));
    if (!items.length) return;

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
          entry.target.classList.add('reveal-anim');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -16px 0px' });

    var vh = window.innerHeight;
    items.forEach(function (el, i) {
      if (el.getBoundingClientRect().top < vh) {
        /* 初期ビューポート内: インデックス順に時差表示（最大 350ms でキャップ）*/
        el.style.setProperty('--reveal-delay', Math.min(60 + i * 75, 350) + 'ms');
        el.classList.add('reveal-anim');
      } else {
        /* スクロール圏外: Intersection Observer に委譲 */
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
    /* VT 対応ブラウザ: 初回ロード時のみリビールを実行 */
    /* VT ナビゲーション時は e.viewTransition が設定されるのでスキップ */
    window.addEventListener('pagereveal', function (e) {
      if (!e.viewTransition) {
        initSectionReveals();
      }
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
