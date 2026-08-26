export const SECRET_BOSS_IDS = ["easy", "medium", "hard", "expert", "absolute"];

export function freshSecretProgress() {
  return {
    unlocked: false,
    unlockNoticeShown: false,
    completed: Object.fromEntries(SECRET_BOSS_IDS.map((bossId) => [bossId, false])),
  };
}

export function sanitizeSecretProgress(value) {
  const fresh = freshSecretProgress();
  if (!value || typeof value !== "object") return fresh;
  fresh.unlocked = value.unlocked === true;
  fresh.unlockNoticeShown = value.unlockNoticeShown === true;
  for (const bossId of SECRET_BOSS_IDS) {
    fresh.completed[bossId] = value.completed?.[bossId] === true;
  }
  return fresh;
}

export function createFreshStats(difficultyIds) {
  return {
    completed: Object.fromEntries(difficultyIds.map((difficulty) => [difficulty, []])),
    totalSolved: 0,
    currentLevel: Object.fromEntries(difficultyIds.map((difficulty) => [difficulty, 0])),
    secret: freshSecretProgress(),
  };
}

export function sanitizeStats(stored, {
  difficultyIds,
  levelsPerDifficulty,
}) {
  const fallback = createFreshStats(difficultyIds);
  if (!stored || typeof stored !== "object") return fallback;

  for (const difficulty of difficultyIds) {
    const completed = Array.isArray(stored.completed?.[difficulty])
      ? stored.completed[difficulty].filter((level) => (
        Number.isInteger(level) && level >= 0 && level < levelsPerDifficulty
      ))
      : [];
    fallback.completed[difficulty] = [...new Set(completed)];
    const current = Number(stored.currentLevel?.[difficulty]);
    fallback.currentLevel[difficulty] = Number.isInteger(current)
      ? Math.max(0, Math.min(levelsPerDifficulty - 1, current))
      : 0;
  }

  fallback.totalSolved = Math.max(0, Number(stored.totalSolved) || 0);
  fallback.secret = sanitizeSecretProgress(stored.secret);

  // Frühere Endless- und Timer-Felder werden absichtlich nicht übernommen.
  // Levelauswahl, normaler Fortschritt und Bossfortschritt bleiben erhalten.
  return fallback;
}
