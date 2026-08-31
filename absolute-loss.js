export const ABSOLUTE_LOSS_TIMING = Object.freeze({
  dim: 850,
  titleFade: 950,
  titleHold: 2000,
});

export function playAbsoluteLossMusic(audio) {
  if (!audio) return false;
  try {
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback?.catch) playback.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export function stopAbsoluteLossMusic(audio) {
  if (!audio) return false;
  try {
    audio.pause();
    audio.currentTime = 0;
    return true;
  } catch {
    return false;
  }
}

export async function runAbsoluteLossSequence({
  wait,
  showBackdrop,
  showTitle,
  showRetry,
  playMusic,
}) {
  showBackdrop();
  playMusic();
  await wait(ABSOLUTE_LOSS_TIMING.dim);
  showTitle();
  await wait(ABSOLUTE_LOSS_TIMING.titleFade);
  await wait(ABSOLUTE_LOSS_TIMING.titleHold);
  showRetry();
}
