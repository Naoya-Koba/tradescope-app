(function () {
  const EDGE_ZONE_PX = 24;
  const HORIZONTAL_TRIGGER_PX = 14;
  const HORIZONTAL_PRIORITY = 1.08;
  let edgeSwipe = null;

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

    edgeSwipe = {
      startX: touch.clientX,
      startY: touch.clientY,
      fromLeft,
      fromRight
    };
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!edgeSwipe || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const dx = touch.clientX - edgeSwipe.startX;
    const dy = touch.clientY - edgeSwipe.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const horizontalIntent = absDx > HORIZONTAL_TRIGGER_PX && absDx > absDy * HORIZONTAL_PRIORITY;
    const isBrowserHistoryDirection = (edgeSwipe.fromLeft && dx > 0) || (edgeSwipe.fromRight && dx < 0);

    if (horizontalIntent && isBrowserHistoryDirection) {
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