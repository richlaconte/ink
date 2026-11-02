// Timing for "writing in" ordinary text: words appear left to right, timed by
// their width, with a pause at each new line — then fitted to a time budget
// (compressed only, never stretched).

export interface WordBox { width: number; top: number }
export interface WordTiming { delay: number; duration: number }

export const WRITE_SPEED = 0.55; // px per ms
export const LINE_PAUSE = 40;    // ms

export function writeSchedule(words: WordBox[], budget: number, speed = 1): WordTiming[] {
  let natural = 0;
  words.forEach((w, n) => { natural += w.width / WRITE_SPEED + (n && w.top > words[n - 1].top + 2 ? LINE_PAUSE : 0); });
  const k = (budget > 0 ? Math.min(1, budget / Math.max(1, natural)) : 1) / speed;
  let t = 0;
  return words.map((w, n) => {
    if (n && w.top > words[n - 1].top + 2) t += LINE_PAUSE * k;
    const duration = (w.width / WRITE_SPEED) * k, delay = t;
    t += duration;
    return { delay, duration };
  });
}
