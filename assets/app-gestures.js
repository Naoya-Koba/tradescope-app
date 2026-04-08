(function () {
  const EDGE_ZONE_PX = 32;
  const HORIZONTAL_TRIGGER_PX = 10;
  const HORIZONTAL_PRIORITY = 1.02;
  const INTERACTIVE_TARGET_SELECTOR = 'button, a, input, select, textarea, label, summary, [role="button"], [role="link"], .menu-btn, .icon-btn';
  let edgeSwipe = null;

  document.documentElement.style.overscrollBehaviorX = 'none';
  document.body.style.overscrollBehaviorX = 'none';
  document.documentElement.style.touchAction = 'pan-y pinch-zoom';
  document.body.style.touchAction = 'pan-y pinch-zoom';

  function resetEdgeSwipe() {
    edgeSwipe = null;
  }

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest(INTERACTIVE_TARGET_SELECTOR));
  }

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      resetEdgeSwipe();
      return;
    }

    const touch = event.touches[0];
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const fromLeft = touch.clientX <= EDGE_ZONE_PX;
    const fromRight = touch.clientX >= viewportWidth - EDGE_ZONE_PX;

    if (!fromLeft && !fromRight) {
      resetEdgeSwipe();
      return;
    }

    if (isInteractiveTarget(event.target)) {
      resetEdgeSwipe();
      return;
    }

    edgeSwipe = {
      startX: touch.clientX,
      startY: touch.clientY,
      fromLeft,
      fromRight
    };
  }, { passive: false, capture: true });

  document.addEventListener('touchmove', (event) => {
    if (!edgeSwipe || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const dx = touch.clientX - edgeSwipe.startX;
    const dy = touch.clientY - edgeSwipe.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const horizontalIntent = absDx > HORIZONTAL_TRIGGER_PX && absDx > absDy * HORIZONTAL_PRIORITY;
    const isBrowserHistoryDirection = (edgeSwipe.fromLeft && dx > 0) || (edgeSwipe.fromRight && dx < 0);

    if (isBrowserHistoryDirection && (horizontalIntent || absDx > 2)) {
      event.preventDefault();
      return;
    }

    if (absDy > absDx) {
      resetEdgeSwipe();
    }
  }, { passive: false });

  document.addEventListener('touchend', resetEdgeSwipe, { passive: true });
  document.addEventListener('touchcancel', resetEdgeSwipe, { passive: true });
})();

(function () {
  const COLLAPSE_STYLE_ID = 'ts-collapse-style';

  function ensureCollapseStyle() {
    if (document.getElementById(COLLAPSE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = COLLAPSE_STYLE_ID;
    style.textContent = `
      .ts-collapse-heading {
        cursor: pointer;
        user-select: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .ts-collapse-icon {
        font-size: 11px;
        color: rgba(170,181,208,.95);
        transform: translateY(-1px);
      }

      .ts-collapsible-target.ts-collapsed {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function resolveToggleTarget(heading) {
    const sectionHead = heading.closest('.summary-header, .annual-summary-head, .performance-head');
    let node = (sectionHead || heading).nextElementSibling;

    while (node) {
      if (node.matches('.section, .chart-area, .memo-section')) return node;
      node = node.nextElementSibling;
    }
    return null;
  }

  function toggleSection(target, iconEl) {
    target.classList.toggle('ts-collapsed');
    const collapsed = target.classList.contains('ts-collapsed');
    iconEl.textContent = collapsed ? '▸' : '▾';

    if (!collapsed) {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }
  }

  function bindSectionCollapse() {
    ensureCollapseStyle();
    const headings = document.querySelectorAll('main .heading-muted');

    headings.forEach((heading) => {
      if (heading.dataset.tsCollapseBound === '1') return;

      const target = resolveToggleTarget(heading);
      if (!target) return;

      heading.classList.add('ts-collapse-heading');
      target.classList.add('ts-collapsible-target');

      let iconEl = heading.querySelector('.ts-collapse-icon');
      if (!iconEl) {
        iconEl = document.createElement('span');
        iconEl.className = 'ts-collapse-icon';
        iconEl.textContent = '▾';
        heading.appendChild(iconEl);
      }

      heading.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('a, button, select, input, textarea, label')) return;
        toggleSection(target, iconEl);
      });

      heading.dataset.tsCollapseBound = '1';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSectionCollapse, { once: true });
  } else {
    bindSectionCollapse();
  }
})();