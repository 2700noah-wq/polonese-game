export function waitForPlacementPaint(requestFrame = globalThis.requestAnimationFrame) {
  return new Promise((resolve) => {
    requestFrame(() => requestFrame(resolve));
  });
}
