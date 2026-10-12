// One scheduled frame at most. Static scenes sleep until an interaction invalidates them.
export function createRenderLoop({ render, request = callback => requestAnimationFrame(callback), cancel = id => cancelAnimationFrame(id) }) {
  let frame = null, paused = false, disposed = false;
  const invalidate = () => {
    if (!disposed && !paused && frame === null) frame = request(tick);
  };
  const tick = time => {
    frame = null;
    if (!disposed && !paused && render(time)) invalidate();
  };
  return {
    invalidate,
    setPaused(value) {
      paused = value;
      if (paused && frame !== null) { cancel(frame); frame = null; }
      if (!paused) invalidate();
    },
    dispose() { disposed = true; if (frame !== null) cancel(frame); frame = null; },
  };
}
