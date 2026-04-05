(function () {
  const EDGE_ZONE_PX = 32;
  const HORIZONTAL_TRIGGER_PX = 10;
  const HORIZONTAL_PRIORITY = 1.02;
  let edgeSwipe = null;

  document.documentElement.style.overscrollBehaviorX = 'none';
  document.body.style.overscrollBehaviorX = 'none';
  document.documentElement.style.touchAction = 'pan-y pinch-zoom';
  document.body.style.touchAction = 'pan-y pinch-zoom';

  function resetEdgeSwipe() {
    edgeSwipe = null;
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

    event.preventDefault();

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