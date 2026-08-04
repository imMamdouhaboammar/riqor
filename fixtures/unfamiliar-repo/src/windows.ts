export type Window = { start: number; end: number };

export function coalesceWindows(windows: Window[]) {
  windows.sort((left, right) => left.start - right.start);
  return windows.filter((window, index) => index === 0 || windows[index - 1].end < window.start);
}
