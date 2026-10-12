// Measure delivered frames while active, never treat idle time as low FPS.
export class PerformanceMonitor {
  constructor() { this.reset(); this.scale = 1; this.lastChange = -Infinity; }
  reset() { this.frames = []; this.last = null; this.lastReport = 0; }
  sample(time, target, adaptive) {
    const interval = this.last == null ? 0 : time - this.last; this.last = time;
    if (interval > 0 && interval < 1000) this.frames.push(interval);
    if (this.frames.length > 120) this.frames.shift();
    if (time - this.lastReport < 1200 || this.frames.length < 20) return null;
    this.lastReport = time;
    const sorted = [...this.frames].sort((a,b)=>a-b);
    const median = sorted[Math.floor(sorted.length/2)];
    const p95 = sorted[Math.floor((sorted.length-1)*.95)];
    const oldScale = this.scale;
    if (adaptive && time-this.lastChange > 3000 && median > 1000/target*1.3) this.scale = Math.max(.6, this.scale-.1);
    else if (adaptive && time-this.lastChange > 8000 && median < 1000/target*1.1) this.scale = Math.min(1,this.scale+.05);
    if (oldScale !== this.scale) { this.lastChange = time; this.frames = []; }
    return { fps: Math.round(1000/median), frameMs: p95, scale: this.scale, changed: oldScale !== this.scale };
  }
}
