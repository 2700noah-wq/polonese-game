export const NORMAL_BOSS_THEFTS = 3;
export const ABSOLUTE_HITS_TO_WIN = 3;
export const NORMAL_BOSS_REMAINING_TRIGGERS = [2, 1, 0];
export const ABSOLUTE_REMAINING_TRIGGERS = [2, 1, 0];

export function createBossState(bossId) {
  return {
    id: bossId,
    thefts: [],
    hits: 0,
    attackCount: 0,
    inputLocked: false,
    attackWindow: false,
    dead: false,
    pendingMutation: null,
  };
}

export function isAbsoluteBoss(bossState) {
  return bossState?.id === "absolute";
}

export function shouldStartNormalAttack(bossState, placedCount, pieceCount) {
  const remainingTrigger = NORMAL_BOSS_REMAINING_TRIGGERS[bossState?.attackCount];
  return Boolean(
    bossState
    && !isAbsoluteBoss(bossState)
    && bossState.attackCount < NORMAL_BOSS_THEFTS
    && pieceCount - placedCount === remainingTrigger,
  );
}

export function shouldStartAbsoluteAttack(bossState, placedCount, pieceCount) {
  const remainingTrigger = ABSOLUTE_REMAINING_TRIGGERS[bossState?.attackCount];
  return Boolean(
    bossState
    && isAbsoluteBoss(bossState)
    && !bossState.dead
    && bossState.hits < ABSOLUTE_HITS_TO_WIN
    && Number.isInteger(remainingTrigger)
    && pieceCount - placedCount === remainingTrigger,
  );
}

// Die drei definierten Phasen werden nur einmal automatisch ausgelöst. Wenn
// Absolut einen Angriff verpasst, bleibt der bisherige Kampf aber wiederholbar:
// Nach dem Auffüllen des Ersatzsteins kann der Spieler weitere Treffer sammeln.
// Dieser Rückweg ist absichtlich getrennt vom 2→1→0-Phasentrigger.
export function shouldStartAbsoluteRetry(bossState, placedCount, pieceCount) {
  return Boolean(
    bossState
    && isAbsoluteBoss(bossState)
    && !bossState.dead
    && bossState.hits < ABSOLUTE_HITS_TO_WIN
    && bossState.attackCount >= ABSOLUTE_REMAINING_TRIGGERS.length
    && pieceCount - placedCount === 0,
  );
}

export function recordTheft(bossState, stolen) {
  bossState.thefts.push(stolen);
  bossState.attackCount += 1;
  bossState.pendingMutation = null;
  return bossState;
}

export function recordAbsoluteMiss(bossState, stolen) {
  bossState.thefts.push(stolen);
  bossState.attackCount += 1;
  bossState.pendingMutation = null;
  return bossState;
}

export function recordAbsoluteHit(bossState) {
  if (!isAbsoluteBoss(bossState) || bossState.dead) return bossState;
  bossState.hits = Math.min(ABSOLUTE_HITS_TO_WIN, bossState.hits + 1);
  bossState.attackCount += 1;
  bossState.pendingMutation = null;
  if (bossState.hits === ABSOLUTE_HITS_TO_WIN) {
    bossState.dead = true;
  }
  return bossState;
}

export function canFinishBoss(bossState, boardComplete) {
  if (!bossState || !boardComplete) return false;
  if (isAbsoluteBoss(bossState)) return bossState.dead;
  return bossState.attackCount === NORMAL_BOSS_THEFTS
    && bossState.thefts.length === NORMAL_BOSS_THEFTS;
}

export function absoluteReactionWindow(hits) {
  return [2400, 2000, 1650][Math.max(0, Math.min(2, hits))];
}
