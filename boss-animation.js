const BASE_THEFT_TIMELINE = Object.freeze({
  search: 420,
  lock: 350,
  wobble: 150,
  suction: 380,
  particles: 250,
});

export const BOSS_THEFT_PROFILES = Object.freeze({
  easy: Object.freeze({ speed: 1.12, intensity: 0.82, particles: 7 }),
  medium: Object.freeze({ speed: 1.04, intensity: 0.96, particles: 9 }),
  hard: Object.freeze({ speed: 0.97, intensity: 1.12, particles: 11 }),
  expert: Object.freeze({ speed: 0.9, intensity: 1.34, particles: 15 }),
  absolute: Object.freeze({ speed: 0.84, intensity: 1.55, particles: 18 }),
});

function scaledDuration(milliseconds, speed) {
  return Math.max(1, Math.round(milliseconds * speed));
}

export function theftPresentationFor(bossId) {
  const profile = BOSS_THEFT_PROFILES[bossId] ?? BOSS_THEFT_PROFILES.medium;
  const durations = Object.fromEntries(
    Object.entries(BASE_THEFT_TIMELINE)
      .map(([stage, milliseconds]) => [stage, scaledDuration(milliseconds, profile.speed)]),
  );
  return Object.freeze({
    ...profile,
    durations: Object.freeze(durations),
    totalMs: Object.values(durations).reduce((sum, milliseconds) => sum + milliseconds, 0),
  });
}

export async function runTheftPrelude(presentation, { startSearch, lockTarget, wait }) {
  startSearch();
  await wait(presentation.durations.search);
  const target = lockTarget();
  await wait(presentation.durations.lock);
  return target;
}

export async function runTheftCapture(presentation, target, {
  warnTarget,
  startSuction,
  releaseParticles,
  wait,
}) {
  if (!target) {
    await wait(
      presentation.durations.wobble
      + presentation.durations.suction
      + presentation.durations.particles,
    );
    return;
  }
  warnTarget(target);
  await wait(presentation.durations.wobble);
  const portal = startSuction(target);
  await wait(presentation.durations.suction);
  releaseParticles(target, portal);
  await wait(presentation.durations.particles);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function theftEffectBounds(boardRect, cellRects) {
  if (!boardRect || !cellRects?.length || boardRect.width <= 0 || boardRect.height <= 0) return null;

  const left = Math.min(...cellRects.map((rect) => rect.left)) - boardRect.left;
  const top = Math.min(...cellRects.map((rect) => rect.top)) - boardRect.top;
  const right = Math.max(...cellRects.map((rect) => rect.right)) - boardRect.left;
  const bottom = Math.max(...cellRects.map((rect) => rect.bottom)) - boardRect.top;
  const cellSize = Math.max(1, Math.min(
    ...cellRects.flatMap((rect) => [rect.width, rect.height]).filter((size) => size > 0),
  ));
  const padding = Math.max(4, cellSize * 0.22);
  const width = Math.min(boardRect.width, right - left + padding * 2);
  const height = Math.min(boardRect.height, bottom - top + padding * 2);
  const targetCenterX = (left + right) / 2;
  const targetCenterY = (top + bottom) / 2;
  const effectLeft = clamp(targetCenterX - width / 2, 0, boardRect.width - width);
  const effectTop = clamp(targetCenterY - height / 2, 0, boardRect.height - height);

  return Object.freeze({
    left: effectLeft,
    top: effectTop,
    width,
    height,
    centerX: effectLeft + width / 2,
    centerY: effectTop + height / 2,
    targetCenterX,
    targetCenterY,
    cellSize,
  });
}
