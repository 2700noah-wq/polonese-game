export function createLevelPickerItems(totalLevels, currentLevelIndex, completedLevels = []) {
  const count = Number.isInteger(totalLevels) && totalLevels > 0 ? totalLevels : 0;
  const current = Number.isInteger(currentLevelIndex) ? currentLevelIndex : 0;
  const completed = new Set(
    completedLevels.filter((level) => Number.isInteger(level) && level >= 0 && level < count),
  );

  return Array.from({ length: count }, (_, index) => ({
    index,
    number: index + 1,
    current: index === current,
    completed: completed.has(index),
  }));
}
