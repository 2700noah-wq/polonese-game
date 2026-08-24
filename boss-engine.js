export const NORMAL_BOSS_THEFTS = 3;
export const ABSOLUTE_HITS_TO_WIN = 3;

export function createBossState(bossId) {
  return {
    id: bossId,
    thefts: [],
    hits: 0,
    attackCount: 0,
    phase: "puzzle",
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
  return Boolean(
    bossState
    && !isAbsoluteBoss(bossState)
    && bossState.phase === "puzzle"
    && bossState.thefts.length < NORMAL_BOSS_THEFTS
    && placedCount === pieceCount - 2,
  );
}

export function shouldStartAbsoluteAttack(bossState, placedCount, pieceCount) {
  return Boolean(
    bossState
    && isAbsoluteBoss(bossState)
    && !bossState.dead
    && bossState.phase === "puzzle"
    && bossState.hits < ABSOLUTE_HITS_TO_WIN
    && placedCount === pieceCount - 2,
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
    bossState.phase = "final";
  }
  return bossState;
}

export function shouldStartFalseEnding(bossState, boardComplete) {
  return Boolean(
    bossState
    && !isAbsoluteBoss(bossState)
    && bossState.thefts.length === NORMAL_BOSS_THEFTS
    && bossState.phase === "puzzle"
    && boardComplete,
  );
}

export function beginFinalBoard(bossState) {
  bossState.phase = "final";
  bossState.pendingMutation = null;
  return bossState;
}

export function canFinishBoss(bossState, boardComplete) {
  if (!bossState || !boardComplete) return false;
  if (isAbsoluteBoss(bossState)) return bossState.dead;
  return bossState.phase === "final" && bossState.thefts.length === NORMAL_BOSS_THEFTS;
}

export function absoluteReactionWindow(hits) {
  return [2400, 2000, 1650][Math.max(0, Math.min(2, hits))];
}
