/** Poll observations only while visible. Never overlap calls or restart after disposal. */
export class IsleVisibleRefresh {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = true;
  private readonly onVisible = () => { void this.tick(); };
  constructor(private readonly refresh: () => Promise<void>,
              private readonly visible: () => boolean,
              private readonly periodMs = 30000,
              private readonly events: Pick<Document, 'addEventListener' | 'removeEventListener'> = document) {}
  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.events.addEventListener('visibilitychange', this.onVisible);
    this.schedule();
  }
  stop(): void {
    this.stopped = true;
    this.events.removeEventListener('visibilitychange', this.onVisible);
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private schedule(): void {
    if (!this.stopped && this.timer === null) this.timer = setTimeout(() => {
      this.timer = null; void this.tick();
    }, this.periodMs);
  }
  async tick(): Promise<void> {
    if (this.stopped || this.running) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (!this.visible()) { this.schedule(); return; }
    this.running = true;
    try { await this.refresh(); }
    catch { /* The view owns its error state; keep retrying after transient failure. */ }
    finally { this.running = false; this.schedule(); }
  }
}

/** Recent receipt is not proof of connectivity; future clocks must never appear fresh. */
export function isleReportFreshness(value: unknown, now = Date.now()): 'recent' | 'older' | 'not-reported' | 'clock-skew' {
  if (typeof value !== 'string' || !value) return 'not-reported';
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return 'not-reported';
  if (stamp > now + 300000) return 'clock-skew';
  return now - stamp <= 600000 ? 'recent' : 'older';
}
