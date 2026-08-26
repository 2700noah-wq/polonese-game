import {
  FIXED_LEVELS_PER_DIFFICULTY,
  PIECES,
  generatePuzzle,
  hashSeed,
  placementsEqual,
} from "./logic.js";
import {
  canonicalShapeKey,
  createPuzzleModel,
  isConnectedShape,
  normalizeCells,
} from "./puzzle-model.js";

export const SECRET_NOTICE_MS = 3000;
export const BOSS_ORDER = ["easy", "medium", "hard", "expert", "absolute"];

export const BOSS_CONFIG = {
  easy: {
    label: "Leicht",
    targetClues: 4,
    color: "#d86b78",
    accent: "#ffd7dc",
    personality: "Neugieriger Trickser",
  },
  medium: {
    label: "Mittel",
    targetClues: 3,
    color: "#a63446",
    accent: "#ff9dad",
    personality: "Berechnender Dieb",
  },
  hard: {
    label: "Schwer",
    targetClues: 2,
    color: "#662139",
    accent: "#ff6b82",
    personality: "Selbstsicherer Plünderer",
  },
  expert: {
    label: "Polonesisch",
    targetClues: 1,
    color: "#321328",
    accent: "#ff3155",
    personality: "Arroganter Herrscher",
  },
  absolute: {
    label: "Absolut",
    targetClues: 1,
    color: "#100914",
    accent: "#ff002f",
    personality: "Der letzte König",
  },
};

const NORMAL_DIFFICULTY_BY_BOSS = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  expert: "expert",
};

function difficultyFinished(completed, difficulty) {
  return Array.isArray(completed?.[difficulty])
    && new Set(completed[difficulty]).size >= FIXED_LEVELS_PER_DIFFICULTY;
}

export function isSecretModeUnlocked(completed) {
  return difficultyFinished(completed, "easy");
}

export function isBossUnlocked(bossId, completed, secretProgress) {
  if (bossId === "absolute") {
    return ["easy", "medium", "hard", "expert"].every((id) => secretProgress?.completed?.[id] === true);
  }
  const difficulty = NORMAL_DIFFICULTY_BY_BOSS[bossId];
  return Boolean(difficulty && difficultyFinished(completed, difficulty));
}

export function secretModeLockMessage() {
  return "Schließe zuerst alle Level von Stufe Leicht ab, um die Secret Level freizuschalten.";
}

export function bossLockMessage(bossId) {
  if (bossId === "absolute") {
    return "Besiege zuerst alle anderen Secret-Level-Bosse, um Absolut freizuschalten.";
  }
  const label = BOSS_CONFIG[bossId]?.label ?? "dieser Schwierigkeit";
  return `Schließe zuerst alle Level von Stufe ${label} ab, um diesen Boss freizuschalten.`;
}

export function createBossSelectionItems(completed, secretProgress) {
  return BOSS_ORDER.map((bossId) => ({
    id: bossId,
    ...BOSS_CONFIG[bossId],
    unlocked: isBossUnlocked(bossId, completed, secretProgress),
    completed: secretProgress?.completed?.[bossId] === true,
  }));
}

function chooseBossClues(solution, count, bossId) {
  const seed = hashSeed(`secret-clues-${bossId}`);
  const ranked = solution
    .map((placement, index) => ({ placement, rank: hashSeed(`${seed}-${placement.pieceId}-${index}`) }))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, count)
    .map(({ placement }) => ({ ...placement }));
  const pieceOrder = new Map(PIECES.map((piece, index) => [piece.id, index]));
  return ranked.sort((left, right) => pieceOrder.get(left.pieceId) - pieceOrder.get(right.pieceId));
}

export function createBossPuzzle(bossId) {
  const config = BOSS_CONFIG[bossId];
  if (!config) throw new Error(`Unbekannter Secret-Level-Boss: ${bossId}`);
  const generated = generatePuzzle(hashSeed(`polonese-secret-v1-${bossId}`), "expert");
  const pieces = PIECES.map((piece) => ({ ...piece, cells: piece.cells.map((cell) => [...cell]) }));
  const model = createPuzzleModel({ pieces, rows: 5, cols: 10 });
  const clues = chooseBossClues(generated.solution, config.targetClues, bossId);
  return {
    seed: hashSeed(`polonese-secret-v1-${bossId}`),
    bossId,
    difficulty: bossId === "absolute" ? "expert" : bossId,
    rows: 5,
    cols: 10,
    mask: null,
    pieces,
    clues,
    solution: generated.solution.map((placement) => ({ ...placement })),
    model,
  };
}

export function createStaticBossPiece(bossId, kind) {
  if (kind === "i") {
    return {
      id: `boss-${bossId}-i`,
      name: "Berło",
      color: "#111827",
      role: "boss-i",
      bossPiece: true,
      cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    };
  }
  if (kind === "x") {
    return {
      id: `boss-${bossId}-x`,
      name: "Korona",
      color: "#f2b705",
      role: "boss-x",
      bossPiece: true,
      cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
    };
  }
  throw new Error(`Unbekannter Bossstein: ${kind}`);
}

function mergeRequiredClues(placements, clues) {
  const byId = new Map(placements.map((placement) => [placement.pieceId, placement]));
  for (const clue of clues) {
    if (!byId.has(clue.pieceId)) byId.set(clue.pieceId, clue);
  }
  return [...byId.values()];
}

function candidateOrder(placements, clues, attackIndex, seed) {
  const clueIds = new Set(clues.map((clue) => clue.pieceId));
  return [...placements].sort((left, right) => {
    const leftClue = clueIds.has(left.pieceId);
    const rightClue = clueIds.has(right.pieceId);
    const preferClue = attackIndex % 2 === 0;
    if (leftClue !== rightClue) return leftClue === preferClue ? -1 : 1;
    return hashSeed(`${seed}-${left.pieceId}`) - hashSeed(`${seed}-${right.pieceId}`);
  });
}

export function planStaticMutation({
  puzzle,
  placements,
  replacementPiece,
  attackIndex = 0,
  seed = 0,
}) {
  const clues = puzzle.clues;
  for (const stolenPlacement of candidateOrder(placements, clues, attackIndex, seed)) {
    const stolenPiece = puzzle.model.getPiece(stolenPlacement.pieceId);
    if (!stolenPiece || canonicalShapeKey(stolenPiece.cells) === canonicalShapeKey(replacementPiece.cells)) continue;
    const remainingPlacements = placements.filter((placement) => placement.pieceId !== stolenPlacement.pieceId);
    const nextClues = clues.filter((clue) => clue.pieceId !== stolenPlacement.pieceId);
    const nextPieces = [
      ...puzzle.pieces.filter((piece) => piece.id !== stolenPlacement.pieceId),
      replacementPiece,
    ];
    const model = createPuzzleModel({
      pieces: nextPieces,
      rows: puzzle.rows,
      cols: puzzle.cols,
      mask: puzzle.mask,
    });
    const locked = mergeRequiredClues(remainingPlacements, nextClues);
    const solved = model.solve(locked, { limit: 1, seed: hashSeed(`${seed}-${stolenPlacement.pieceId}`) });
    if (!solved.solution || !model.validateCompletedBoard(solved.solution, nextClues)) continue;
    return {
      stolen: {
        piece: { ...stolenPiece, cells: stolenPiece.cells.map((cell) => [...cell]) },
        placement: { ...stolenPlacement },
        wasClue: clues.some((clue) => clue.pieceId === stolenPlacement.pieceId),
      },
      replacement: replacementPiece,
      pieces: nextPieces,
      clues: nextClues,
      solution: solved.solution,
      model,
    };
  }
  return null;
}

function occupiedCells(model, placements) {
  return new Set(placements.flatMap((placement) => model.placementCells(placement)));
}

function cellCoordinates(cells, cols) {
  return cells.map((cell) => [Math.floor(cell / cols), cell % cols]);
}

function createMutationPiece(bossId, serial, cells) {
  return {
    id: `boss-${bossId}-mutation-${serial}`,
    name: `Cień ${serial}`,
    color: ["#15152d", "#7a1432", "#cb1b45", "#4b164c"][serial % 4],
    role: "boss-custom",
    bossPiece: true,
    cells: cells.map((cell) => [...cell]),
  };
}

function validateMutationPlan({
  puzzle,
  stolenPlacement,
  stolenPiece,
  replacement,
  fixed,
  nextClues,
  seed,
  proposedSolution = null,
}) {
  const nextPieces = [
    ...puzzle.pieces.filter((piece) => piece.id !== stolenPlacement.pieceId),
    replacement,
  ];
  const model = createPuzzleModel({
    pieces: nextPieces,
    rows: puzzle.rows,
    cols: puzzle.cols,
    mask: puzzle.mask,
  });
  if (proposedSolution && !model.validateCompletedBoard(proposedSolution, nextClues)) return null;

  // Alle sichtbaren, nicht gestohlenen Steine bleiben feste Solver-Vorgaben.
  // Dadurch beschreibt die validierte Lösung exakt den Zustand, den der
  // Spieler nach der Animation tatsächlich vor sich hat.
  const locked = mergeRequiredClues(fixed, nextClues);
  const solved = model.solve(locked, { limit: 1, seed });
  if (!solved.solution || !model.validateCompletedBoard(solved.solution, nextClues)) return null;

  return {
    stolen: {
      piece: { ...stolenPiece, cells: stolenPiece.cells.map((cell) => [...cell]) },
      placement: { ...stolenPlacement },
      wasClue: puzzle.clues.some((clue) => clue.pieceId === stolenPlacement.pieceId),
    },
    replacement,
    pieces: nextPieces,
    clues: nextClues,
    solution: solved.solution,
    model,
  };
}

export function planNovelMutation({
  puzzle,
  placements,
  bossId,
  serial,
  attackIndex = 0,
  seed = 0,
}) {
  const clues = puzzle.clues;
  let best = null;
  let explored = 0;
  const maxExplored = 4000;

  for (const stolenPlacement of candidateOrder(placements, clues, attackIndex, seed)) {
    const stolenPiece = puzzle.model.getPiece(stolenPlacement.pieceId);
    if (!stolenPiece) continue;
    const fixed = placements.filter((placement) => placement.pieceId !== stolenPlacement.pieceId);
    const nextClues = clues.filter((clue) => clue.pieceId !== stolenPlacement.pieceId);
    const fixedIds = new Set(fixed.map((placement) => placement.pieceId));
    const remainingPieces = puzzle.pieces.filter((piece) => (
      piece.id !== stolenPlacement.pieceId && !fixedIds.has(piece.id)
    ));
    const occupied = occupiedCells(puzzle.model, fixed);
    const activeShapeKeys = new Set(
      puzzle.pieces
        .filter((piece) => piece.id !== stolenPlacement.pieceId)
        .map((piece) => canonicalShapeKey(piece.cells)),
    );
    const stolenShapeKey = canonicalShapeKey(stolenPiece.cells);
    const clueById = new Map(nextClues.map((clue) => [clue.pieceId, clue]));

    const optionMap = new Map(remainingPieces.map((piece) => {
      const required = clueById.get(piece.id);
      const options = puzzle.model.placementsFor(piece.id).filter((placement) => (
        (!required || placementsEqual(placement, required))
        && placement.cells.every((cell) => !occupied.has(cell))
      ));
      return [piece.id, options];
    }));

    const chosen = [];
    const used = new Set();

    function search() {
      if (explored >= maxExplored) return;
      if (chosen.length === remainingPieces.length) {
        explored += 1;
        const filled = new Set(occupied);
        chosen.forEach((placement) => puzzle.model.placementCells(placement).forEach((cell) => filled.add(cell)));
        const leftover = [...puzzle.model.activeCells].filter((cell) => !filled.has(cell));
        if (leftover.length !== 5) return;
        const coordinates = cellCoordinates(leftover, puzzle.cols);
        const minRow = Math.min(...coordinates.map(([row]) => row));
        const minCol = Math.min(...coordinates.map(([, col]) => col));
        const shape = normalizeCells(coordinates);
        const maxRow = Math.max(...shape.map(([row]) => row));
        const maxCol = Math.max(...shape.map(([, col]) => col));
        if (maxRow >= 5 || maxCol >= 5) return;
        const shapeKey = canonicalShapeKey(shape);
        if (shapeKey === stolenShapeKey || activeShapeKeys.has(shapeKey)) return;

        const replacement = createMutationPiece(bossId, serial, shape);
        const replacementPlacement = {
          pieceId: replacement.id,
          variant: 0,
          row: minRow,
          col: minCol,
        };
        const proposedSolution = [...fixed, ...chosen.map((placement) => ({ ...placement })), replacementPlacement];
        const plan = validateMutationPlan({
          puzzle,
          stolenPlacement,
          stolenPiece,
          replacement,
          fixed,
          nextClues,
          seed: hashSeed(`${seed}-${stolenPlacement.pieceId}-${shapeKey}`),
          proposedSolution,
        });
        if (!plan) return;

        const score = (isConnectedShape(shape) ? 50 : 0)
          + (maxRow < 5 && maxCol < 5 ? 20 : 0)
          - (maxRow + 1) * (maxCol + 1) * 0.1;
        if (!best || score > best.score) {
          best = { score, ...plan };
        }
        return;
      }

      const nextPiece = remainingPieces
        .filter((piece) => !used.has(piece.id))
        .sort((left, right) => optionMap.get(left.id).length - optionMap.get(right.id).length)[0];
      if (!nextPiece) return;
      used.add(nextPiece.id);
      const randomized = [...optionMap.get(nextPiece.id)].sort((left, right) => (
        hashSeed(`${seed}-${left.pieceId}-${left.variant}-${left.row}-${left.col}`)
        - hashSeed(`${seed}-${right.pieceId}-${right.variant}-${right.row}-${right.col}`)
      ));
      for (const placement of randomized) {
        const cells = puzzle.model.placementCells(placement);
        if (cells.some((cell) => occupied.has(cell))) continue;
        cells.forEach((cell) => occupied.add(cell));
        chosen.push(placement);
        search();
        chosen.pop();
        cells.forEach((cell) => occupied.delete(cell));
        if (best?.score >= 50 || explored >= maxExplored) break;
      }
      used.delete(nextPiece.id);
    }

    search();
    if (best?.score >= 50) break;
  }

  if (best) {
    const { score: _score, ...plan } = best;
    return plan;
  }

  // Bei einem vollständig belegten Brett kann ein anderer Fußabdruck die
  // neun verbliebenen Steine unmöglich unverändert lassen. In diesem Fall ist
  // der sichere Ersatz ein neuer Boss-Stein mit dem Fußabdruck des Diebstahls.
  // Er besitzt eine neue Identität, der gestohlene Stein bleibt aber entfernt.
  for (const stolenPlacement of candidateOrder(placements, clues, attackIndex, `${seed}-fallback`)) {
    const stolenPiece = puzzle.model.getPiece(stolenPlacement.pieceId);
    if (!stolenPiece) continue;
    const fixed = placements.filter((placement) => placement.pieceId !== stolenPlacement.pieceId);
    const nextClues = clues.filter((clue) => clue.pieceId !== stolenPlacement.pieceId);
    const replacement = createMutationPiece(bossId, serial, stolenPiece.cells);
    const plan = validateMutationPlan({
      puzzle,
      stolenPlacement,
      stolenPiece,
      replacement,
      fixed,
      nextClues,
      seed: hashSeed(`${seed}-fallback-${stolenPlacement.pieceId}`),
    });
    if (plan) return plan;
  }

  return null;
}
