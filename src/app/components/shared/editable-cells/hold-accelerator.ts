/**
 * hold-accelerator.ts
 *
 * Shared utility for hold-to-accelerate spinner behavior.
 * Starts slow (step=1), accelerates with duration.
 */

export interface AcceleratorConfig {
  /** Base step size at normal speed. Default 1. */
  baseStep?: number;
  /** Accelerated step size after hold threshold. */
  fastStep?: number;
  /** Milliseconds before switching from slow to medium rate. Default 600. */
  mediumAfterMs?: number;
  /** Milliseconds before switching to fast rate. Default 1800. */
  fastAfterMs?: number;
}

const PHASE_SLOW_INTERVAL = 300;
const PHASE_MEDIUM_INTERVAL = 120;
const PHASE_FAST_INTERVAL = 60;

/**
 * Create a hold-accelerator that fires a callback with increasing step sizes.
 * Call `start()` on mousedown/touchstart, `stop()` on mouseup/mouseleave/touchend.
 */
export function createHoldAccelerator(
  callback: (step: number) => void,
  config: AcceleratorConfig = {}
): { start: () => void; stop: () => void } {
  const baseStep = config.baseStep ?? 1;
  const fastStep = config.fastStep ?? baseStep;
  const mediumAfterMs = config.mediumAfterMs ?? 600;
  const fastAfterMs = config.fastAfterMs ?? 1800;

  let timer: any = null;
  let startTime = 0;

  function tick() {
    const elapsed = Date.now() - startTime;
    let step: number;
    let interval: number;

    if (elapsed > fastAfterMs) {
      step = fastStep;
      interval = PHASE_FAST_INTERVAL;
    } else if (elapsed > mediumAfterMs) {
      step = baseStep;
      interval = PHASE_MEDIUM_INTERVAL;
    } else {
      step = baseStep;
      interval = PHASE_SLOW_INTERVAL;
    }

    callback(step);
    timer = setTimeout(tick, interval);
  }

  return {
    start() {
      this.stop();
      startTime = Date.now();
      callback(baseStep); // Immediate first tick
      timer = setTimeout(tick, PHASE_SLOW_INTERVAL);
    },
    stop() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }
  };
}
