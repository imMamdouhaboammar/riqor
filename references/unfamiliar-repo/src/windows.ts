export type Window = { start: number; end: number };

export function coalesceWindows(windows: Window[]) {
  if (windows.some(({ start, end }) => !Number.isInteger(start) || !Number.isInteger(end) || start >= end)) {
    throw new Error("invalid window: integer start must precede integer end");
  }
  const sorted = windows.map((window) => ({ ...window })).sort((left, right) => left.start - right.start);
  return sorted.reduce<Window[]>((merged, window) => {
    const previous = merged.at(-1);
    if (!previous || previous.end < window.start) merged.push(window);
    else previous.end = Math.max(previous.end, window.end);
    return merged;
  }, []);
}
