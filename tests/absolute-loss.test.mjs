import assert from "node:assert/strict";
import test from "node:test";

import {
  ABSOLUTE_LOSS_TIMING,
  playAbsoluteLossMusic,
  runAbsoluteLossSequence,
  stopAbsoluteLossMusic,
} from "../absolute-loss.js";

test("Niederlage blendet Hintergrund, Titel, Haltezeit und Retry in dieser Reihenfolge ein", async () => {
  const events = [];
  await runAbsoluteLossSequence({
    wait: async (duration) => events.push(["wait", duration]),
    showBackdrop: () => events.push(["backdrop"]),
    showTitle: () => events.push(["title"]),
    showRetry: () => events.push(["retry"]),
    playMusic: () => events.push(["music"]),
  });

  assert.deepEqual(events, [
    ["backdrop"],
    ["music"],
    ["wait", ABSOLUTE_LOSS_TIMING.dim],
    ["title"],
    ["wait", ABSOLUTE_LOSS_TIMING.titleFade],
    ["wait", 2000],
    ["retry"],
  ]);
});

test("blockiertes Audio-Autoplay blockiert die Niederlage nicht", async () => {
  const audio = {
    currentTime: 7,
    play() {
      return Promise.reject(new Error("Autoplay blockiert"));
    },
  };
  assert.doesNotThrow(() => playAbsoluteLossMusic(audio));
  assert.equal(audio.currentTime, 0);
  await Promise.resolve();
});

test("Retry stoppt die Niederlagenmusik und setzt sie auf Anfang", () => {
  let paused = false;
  const audio = {
    currentTime: 8,
    pause() {
      paused = true;
    },
  };
  assert.equal(stopAbsoluteLossMusic(audio), true);
  assert.equal(paused, true);
  assert.equal(audio.currentTime, 0);
});
