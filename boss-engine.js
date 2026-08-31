export const NORMAL_BOSS_THEFTS = 3;
export const ABSOLUTE_HITS_TO_WIN = 3;
export const NORMAL_BOSS_REMAINING_TRIGGERS = [2, 1, 0];
export const ABSOLUTE_REMAINING_TRIGGERS = [6, 5, 4, 3, 2, 1, 0];

export function createBossState(bossId) {
  return {
    id: bossId,
    thefts: [],
    hits: 0,
    attackCount: 0,
    usedAbsoluteTriggers: [],
    inputLocked: false,
    attackWindow: false,
    dead: false,
    lost: false,
    pendingMutation: null,
  };
}

export function isAbsoluteBoss(bossState) {
  return bossState?.id === "absolute";
}

function absoluteTriggerState(bossState) {
  if (!Array.isArray(bossState?.usedAbsoluteTriggers)) {
    bossState.usedAbsoluteTriggers = [];
  }
  return bossState.usedAbsoluteTriggers;
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
  const remainingCount = pieceCount - placedCount;
  const usedTriggers = isAbsoluteBoss(bossState) ? absoluteTriggerState(bossState) : [];
  return Boolean(
    bossState
    && isAbsoluteBoss(bossState)
    && !bossState.dead
    && !bossState.lost
    && bossState.hits < ABSOLUTE_HITS_TO_WIN
    && ABSOLUTE_REMAINING_TRIGGERS.includes(remainingCount)
    && !usedTriggers.includes(remainingCount)
  );
}

export function markAbsoluteTriggerUsed(bossState, remainingCount) {
  const usedTriggers = isAbsoluteBoss(bossState) ? absoluteTriggerState(bossState) : [];
  if (
    !isAbsoluteBoss(bossState)
    || bossState.dead
    || bossState.lost
    || bossState.hits >= ABSOLUTE_HITS_TO_WIN
    || !ABSOLUTE_REMAINING_TRIGGERS.includes(remainingCount)
    || usedTriggers.includes(remainingCount)
  ) {
    return false;
  }
  usedTriggers.push(remainingCount);
  return true;
}

export function rollbackAbsoluteTrigger(bossState, remainingCount) {
  if (!isAbsoluteBoss(bossState)) return false;
  const usedTriggers = absoluteTriggerState(bossState);
  const index = usedTriggers.indexOf(remainingCount);
  if (index < 0) return false;
  usedTriggers.splice(index, 1);
  return true;
}

export function isAbsoluteRunExhausted(bossState) {
  const usedTriggers = isAbsoluteBoss(bossState) ? absoluteTriggerState(bossState) : [];
  return Boolean(
    isAbsoluteBoss(bossState)
    && !bossState.dead
    && bossState.hits < ABSOLUTE_HITS_TO_WIN
    && ABSOLUTE_REMAINING_TRIGGERS.every((remainingCount) => (
      usedTriggers.includes(remainingCount)
    ))
  );
}

export function finalizeAbsoluteAttack(bossState, remainingCount) {
  if (
    !isAbsoluteBoss(bossState)
    || remainingCount !== 0
    || bossState.dead
    || bossState.hits >= ABSOLUTE_HITS_TO_WIN
    || !absoluteTriggerState(bossState).includes(0)
  ) {
    return false;
  }
  bossState.lost = true;
  bossState.attackWindow = false;
  bossState.pendingMutation = null;
  return true;
}

export function recordTheft(bossState, stolen) {
  bossState.thefts.push(stolen);
  bossState.attackCount += 1;
  bossState.pendingMutation = null;
  return bossState;
}

export function recordAbsoluteMiss(bossState, stolen) {
  if (!isAbsoluteBoss(bossState) || bossState.dead || bossState.lost) return bossState;
  bossState.thefts.push(stolen);
  bossState.attackCount += 1;
  bossState.pendingMutation = null;
  return bossState;
}

export function recordAbsoluteHit(bossState) {
  if (!isAbsoluteBoss(bossState) || bossState.dead || bossState.lost) return bossState;
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
