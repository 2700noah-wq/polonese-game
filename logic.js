export const BOARD_ROWS = 5;
export const BOARD_COLS = 10;
export const BOARD_SIZE = BOARD_ROWS * BOARD_COLS;
export const FIXED_LEVELS_PER_DIFFICULTY = 60;

export const DIFFICULTIES = {
  easy: { label: "Leicht", targetClues: 7, description: "Viele Vorgaben, ideal zum Einsteigen" },
  medium: { label: "Mittel", targetClues: 6, description: "Mehr Raum zum Kombinieren" },
  hard: { label: "Schwer", targetClues: 5, description: "Wenige Vorgaben, viele Möglichkeiten" },
  expert: { label: "Expert", targetClues: 4, description: "Minimale Hilfe für Puzzle-Profis" },
};

export const PIECES = [
  { id: "f", name: "Wisła", color: "#ff3b5c", cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 2]] },
  { id: "l", name: "Giewont", color: "#ff9f1c", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]] },
  { id: "p", name: "Wawel", color: "#ffd60a", cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]] },
  { id: "n", name: "Bałtyk", color: "#2ec4b6", cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]] },
  { id: "t", name: "Syrena", color: "#31a8ff", cells: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]] },
  { id: "u", name: "Mazur", color: "#6c63ff", cells: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { id: "v", name: "Żubr", color: "#9b5de5", cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { id: "w", name: "Bursztyn", color: "#ef4cff", cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { id: "y", name: "Orzeł", color: "#00d084", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1]] },
  { id: "z", name: "Polonez", color: "#ff5d8f", cells: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]] },
];

const PIECE_BY_ID = new Map(PIECES.map((piece) => [piece.id, piece]));

function normalizeCells(cells) {
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));
  return cells
    .map(([row, col]) => [row - minRow, col - minCol])
    .sort(([rowA, colA], [rowB, colB]) => rowA - rowB || colA - colB);
}

function cellsKey(cells) {
  return normalizeCells(cells).map(([row, col]) => `${row},${col}`).join(";");
}

function transformCells(cells, rotation = 0, flipped = false) {
  let transformed = cells.map(([row, col]) => [row, flipped ? -col : col]);
  for (let turn = 0; turn < ((rotation % 4) + 4) % 4; turn += 1) {
    transformed = transformed.map(([row, col]) => [col, -row]);
  }
  return normalizeCells(transformed);
}

function buildVariants(piece) {
  const variants = new Map();
  for (const flipped of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const cells = transformCells(piece.cells, rotation, flipped);
      variants.set(cellsKey(cells), cells);
    }
  }
  return [...variants.values()];
}

const VARIANTS_BY_ID = new Map(PIECES.map((piece) => [piece.id, buildVariants(piece)]));

export function getPiece(pieceId) {
  return PIECE_BY_ID.get(pieceId);
}

export function getVariants(pieceId) {
  return VARIANTS_BY_ID.get(pieceId) ?? [];
}

export function getVariantIndex(pieceId, rotation = 0, flipped = false) {
  const key = cellsKey(transformCells(getPiece(pieceId).cells, rotation, flipped));
  return getVariants(pieceId).findIndex((cells) => cellsKey(cells) === key);
}

export function placementCells(placement) {
  const variant = getVariants(placement.pieceId)[placement.variant];
  if (!variant) return [];
  return variant.map(([row, col]) => {
    const boardRow = placement.row + row;
    const boardCol = placement.col + col;
    return boardRow * BOARD_COLS + boardCol;
  });
}

export function isPlacementInside(placement) {
  const variant = getVariants(placement.pieceId)[placement.variant];
  if (!variant) return false;
  return variant.every(([row, col]) => {
    const boardRow = placement.row + row;
    const boardCol = placement.col + col;
    return boardRow >= 0 && boardRow < BOARD_ROWS && boardCol >= 0 && boardCol < BOARD_COLS;
  });
}

export function placementsEqual(left, right) {
  return Boolean(left && right)
    && left.pieceId === right.pieceId
    && left.variant === right.variant
    && left.row === right.row
    && left.col === right.col;
}

function buildAllPlacements() {
  const byPiece = new Map();
  const byCell = Array.from({ length: BOARD_SIZE }, () => []);

  for (const piece of PIECES) {
    const placements = [];
    getVariants(piece.id).forEach((variant, variantIndex) => {
      const height = Math.max(...variant.map(([row]) => row)) + 1;
      const width = Math.max(...variant.map(([, col]) => col)) + 1;
      for (let row = 0; row <= BOARD_ROWS - height; row += 1) {
        for (let col = 0; col <= BOARD_COLS - width; col += 1) {
          const placement = { pieceId: piece.id, variant: variantIndex, row, col };
          const cells = placementCells(placement);
          const compiled = { ...placement, cells };
          placements.push(compiled);
          cells.forEach((cell) => byCell[cell].push(compiled));
        }
      }
    });
    byPiece.set(piece.id, placements);
  }

  return { byPiece, byCell };
}

const ALL_PLACEMENTS = buildAllPlacements();

export function hashSeed(value) {
  const input = String(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function compileLockedPlacements(lockedPlacements) {
  const occupied = new Set();
  const usedPieces = new Set();
  const compiled = [];

  for (const placement of lockedPlacements) {
    if (!PIECE_BY_ID.has(placement.pieceId) || usedPieces.has(placement.pieceId) || !isPlacementInside(placement)) {
      return null;
    }
    const cells = placementCells(placement);
    if (cells.some((cell) => occupied.has(cell))) return null;
    cells.forEach((cell) => occupied.add(cell));
    usedPieces.add(placement.pieceId);
    compiled.push({ ...placement, cells });
  }

  return { occupied, usedPieces, compiled };
}

export function solvePuzzle(lockedPlacements = [], { limit = 1, seed = 0 } = {}) {
  const initial = compileLockedPlacements(lockedPlacements);
  if (!initial) return { count: 0, solution: null };

  const random = mulberry32(hashSeed(seed));
  const occupied = initial.occupied;
  const usedPieces = initial.usedPieces;
  const chosen = [...initial.compiled];
  let count = 0;
  let firstSolution = null;

  function search() {
    if (count >= limit) return;
    if (usedPieces.size === PIECES.length) {
      if (occupied.size === BOARD_SIZE) {
        count += 1;
        if (!firstSolution) {
          firstSolution = chosen.map(({ cells: _cells, ...placement }) => ({ ...placement }));
        }
      }
      return;
    }

    let bestOptions = null;
    for (let cell = 0; cell < BOARD_SIZE; cell += 1) {
      if (occupied.has(cell)) continue;
      const options = ALL_PLACEMENTS.byCell[cell].filter((placement) => (
        !usedPieces.has(placement.pieceId)
        && placement.cells.every((candidateCell) => !occupied.has(candidateCell))
      ));
      if (options.length === 0) return;
      if (!bestOptions || options.length < bestOptions.length) {
        bestOptions = options;
        if (options.length === 1) break;
      }
    }

    if (!bestOptions) return;
    const orderedOptions = seed ? shuffled(bestOptions, random) : bestOptions;
    for (const placement of orderedOptions) {
      usedPieces.add(placement.pieceId);
      placement.cells.forEach((cell) => occupied.add(cell));
      chosen.push(placement);
      search();
      chosen.pop();
      placement.cells.forEach((cell) => occupied.delete(cell));
      usedPieces.delete(placement.pieceId);
      if (count >= limit) return;
    }
  }

  search();
  return { count, solution: firstSolution };
}

function chooseUniqueClues(solution, targetClues, seed) {
  const random = mulberry32(seed ^ 0xa5a5a5a5);
  let clues = [...solution];
  let changed = true;

  while (changed && clues.length > targetClues) {
    changed = false;
    for (const candidate of shuffled(clues, random)) {
      if (clues.length <= targetClues) break;
      const trial = clues.filter((placement) => placement.pieceId !== candidate.pieceId);
      if (solvePuzzle(trial, { limit: 2 }).count === 1) {
        clues = trial;
        changed = true;
      }
    }
  }

  const order = new Map(PIECES.map((piece, index) => [piece.id, index]));
  return clues.sort((left, right) => order.get(left.pieceId) - order.get(right.pieceId));
}

export function fixedLevelSeed(difficulty, levelIndex) {
  return hashSeed(`polonese-fixed-v1-${difficulty}-${levelIndex}`);
}

export function generatePuzzle(seed, difficulty = "easy") {
  const safeDifficulty = DIFFICULTIES[difficulty] ? difficulty : "easy";
  const numericSeed = hashSeed(seed);
  const solved = solvePuzzle([], { limit: 1, seed: numericSeed || 1 });
  if (!solved.solution) throw new Error("Für diesen Seed konnte kein Spielfeld erzeugt werden.");

  const clues = chooseUniqueClues(
    solved.solution,
    DIFFICULTIES[safeDifficulty].targetClues,
    numericSeed,
  );

  return {
    seed: numericSeed,
    difficulty: safeDifficulty,
    solution: solved.solution,
    clues,
  };
}

export function validateCompletedBoard(placements, clues = []) {
  if (placements.length !== PIECES.length) return false;
  const compiled = compileLockedPlacements(placements);
  if (!compiled || compiled.occupied.size !== BOARD_SIZE) return false;
  return clues.every((clue) => placements.some((placement) => placementsEqual(placement, clue)));
}

