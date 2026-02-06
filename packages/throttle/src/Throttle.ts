import { type TimeSpan, toMilliseconds } from "@hardlydifficult/date-time";
import { StateTracker } from "@hardlydifficult/state-tracker";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface ThrottleOptions {
  minimumDelay: TimeSpan;
  persistKey?: string;
  stateDirectory?: string;
  onSleep?: (ms: number) => void;
}

export class Throttle {
  private lastTimestamp: number;
  private readonly minimumDelayMs: number;
  private readonly stateTracker?: StateTracker<number>;
  private readonly onSleep?: (ms: number) => void;

  constructor(options: ThrottleOptions) {
    this.minimumDelayMs = toMilliseconds(options.minimumDelay);
    if (this.minimumDelayMs <= 0) {
      throw new Error("Throttle minimumDelay must be a positive duration");
    }
    this.onSleep = options.onSleep;

    if (options.persistKey !== undefined) {
      this.stateTracker = new StateTracker({
        key: options.persistKey,
        default: 0,
        stateDirectory: options.stateDirectory,
      });
      this.lastTimestamp = this.stateTracker.load();
    } else {
      this.lastTimestamp = 0;
    }
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const target = Math.max(now, this.lastTimestamp + this.minimumDelayMs);
    const delay = target - now;

    this.lastTimestamp = target;
    this.stateTracker?.save(target);

    if (delay > 0) {
      this.onSleep?.(delay);
      await sleep(delay);
    }
  }
}
