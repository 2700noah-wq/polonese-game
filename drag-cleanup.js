export function clearDragArtifacts({ ghost = null, root = null, body = null } = {}) {
  const artifacts = new Set();
  if (ghost) artifacts.add(ghost);
  root?.querySelectorAll?.(".drag-ghost")?.forEach((artifact) => artifacts.add(artifact));
  artifacts.forEach((artifact) => artifact?.remove?.());
  body?.classList?.remove?.("dragging-piece");
  return artifacts.size;
}

export function releaseCapturedPointer(session) {
  const target = session?.captureTarget;
  if (!target?.releasePointerCapture) return false;
  try {
    if (target.hasPointerCapture && !target.hasPointerCapture(session.pointerId)) return false;
    target.releasePointerCapture(session.pointerId);
    return true;
  } catch {
    // pointercancel darf die Capture bereits vor dem gemeinsamen Cleanup lösen.
    return false;
  }
}
