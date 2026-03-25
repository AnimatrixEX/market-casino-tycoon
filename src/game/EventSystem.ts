// EventSystem.ts — random market events that temporarily affect the market engine

export type EventType =
  | 'pump' | 'crash' | 'fake_pump' | 'volatility_spike'
  | 'whale_buy' | 'whale_sell' | 'flash_crash'
  | 'dead_cat_bounce' | 'short_squeeze' | 'bull_trap';

export interface MarketEvent {
  type: EventType;
  label: string;
  /** Remaining frames the event is active */
  framesLeft: number;
  /** Total duration in frames */
  duration: number;
  /** Trend bias injected (+/-) while active */
  trendBias: number;
  /** Extra volatility multiplier while active */
  volMultiplier: number;
}

interface EventDef {
  type: EventType;
  label: string;
  /** Duration range [min, max] in frames */
  durationRange: [number, number];
  trendBias: number;
  volMultiplier: number;
  /** Relative spawn weight (higher = more likely) */
  weight: number;
}

const EVENT_DEFS: EventDef[] = [
  // Classic events
  {
    type: 'pump', label: 'PUMP',
    durationRange: [150, 260], trendBias: 0.35, volMultiplier: 1.8, weight: 10,
  },
  {
    type: 'crash', label: 'CRASH',
    durationRange: [150, 260], trendBias: -0.35, volMultiplier: 2.0, weight: 10,
  },
  {
    type: 'fake_pump', label: 'FAKE PUMP',
    durationRange: [200, 320], trendBias: 0.22, volMultiplier: 1.5, weight: 7,
  },
  {
    type: 'volatility_spike', label: 'VOLATILITY SPIKE',
    durationRange: [90, 180], trendBias: 0, volMultiplier: 4.0, weight: 6,
  },
  // New events
  {
    type: 'whale_buy', label: 'WHALE BUY',
    durationRange: [60, 120], trendBias: 0.6, volMultiplier: 2.2, weight: 5,
  },
  {
    type: 'whale_sell', label: 'WHALE SELL',
    durationRange: [60, 120], trendBias: -0.6, volMultiplier: 2.2, weight: 5,
  },
  {
    type: 'flash_crash', label: 'FLASH CRASH',
    durationRange: [40, 80], trendBias: -1.0, volMultiplier: 5.0, weight: 3,
  },
  {
    type: 'dead_cat_bounce', label: 'DEAD CAT BOUNCE',
    durationRange: [180, 300], trendBias: -0.25, volMultiplier: 1.6, weight: 4,
  },
  {
    type: 'short_squeeze', label: 'SHORT SQUEEZE',
    durationRange: [100, 180], trendBias: 0.7, volMultiplier: 2.5, weight: 4,
  },
  {
    type: 'bull_trap', label: 'BULL TRAP',
    durationRange: [180, 280], trendBias: 0.25, volMultiplier: 1.4, weight: 5,
  },
];

// Phase-based events: these reverse direction partway through
const PHASE_EVENTS: Record<string, { reverseAt: number; reverseBias: number }> = {
  fake_pump:        { reverseAt: 0.5, reverseBias: -0.45 },
  dead_cat_bounce:  { reverseAt: 0.35, reverseBias: 0.40 },  // drops, then bounces briefly, then resumes drop
  bull_trap:        { reverseAt: 0.45, reverseBias: -0.50 },  // rises, then reverses hard
};

// Second phase reversal for dead cat bounce (the final drop after the bounce)
const DEAD_CAT_PHASE3 = 0.70;

const totalWeight = EVENT_DEFS.reduce((sum, e) => sum + e.weight, 0);

export class EventSystem {
  public currentEvent: MarketEvent | null = null;

  // Track phases already triggered for current event
  private phaseTriggered: Set<string> = new Set();

  // Cooldown between events
  private framesBetweenEvents = 500;
  private framesSinceLast = 0;

  tick(): void {
    // Advance active event countdown
    if (this.currentEvent) {
      this.currentEvent.framesLeft--;

      const ev = this.currentEvent;
      const progress = 1 - (ev.framesLeft / ev.duration); // 0..1

      // Phase-based reversals
      const phaseDef = PHASE_EVENTS[ev.type];
      if (phaseDef) {
        if (progress >= phaseDef.reverseAt && !this.phaseTriggered.has('p1')) {
          ev.trendBias = phaseDef.reverseBias;
          this.phaseTriggered.add('p1');
        }
        // Dead cat bounce has a 3rd phase: resume drop
        if (ev.type === 'dead_cat_bounce' && progress >= DEAD_CAT_PHASE3 && !this.phaseTriggered.has('p2')) {
          ev.trendBias = -0.35;
          ev.volMultiplier = 2.0;
          this.phaseTriggered.add('p2');
        }
        // Bull trap: increase volatility on reversal
        if (ev.type === 'bull_trap' && progress >= 0.55 && !this.phaseTriggered.has('p2')) {
          ev.volMultiplier = 2.5;
          this.phaseTriggered.add('p2');
        }
      }

      // Flash crash: exponential slowdown (bias decays)
      if (ev.type === 'flash_crash') {
        ev.trendBias *= 0.985;
      }

      // Short squeeze: accelerating bias
      if (ev.type === 'short_squeeze' && progress > 0.3) {
        ev.trendBias = Math.min(1.2, ev.trendBias * 1.005);
      }

      if (ev.framesLeft <= 0) {
        this.currentEvent = null;
        this.phaseTriggered.clear();
      }
    }

    // Spawn new event
    this.framesSinceLast++;
    if (!this.currentEvent && this.framesSinceLast >= this.framesBetweenEvents) {
      if (Math.random() < 0.008) {
        this.spawnRandomEvent();
        this.framesSinceLast = 0;
        // Next cooldown: 6-14 seconds at 60fps
        this.framesBetweenEvents = 360 + Math.floor(Math.random() * 480);
      }
    }
  }

  private spawnRandomEvent(): void {
    // Weighted random selection
    let r = Math.random() * totalWeight;
    let chosen = EVENT_DEFS[0];
    for (const def of EVENT_DEFS) {
      r -= def.weight;
      if (r <= 0) { chosen = def; break; }
    }

    const duration = chosen.durationRange[0] +
      Math.floor(Math.random() * (chosen.durationRange[1] - chosen.durationRange[0]));

    // Slight randomization of intensity (+/- 15%)
    const intensityVar = 0.85 + Math.random() * 0.3;

    this.currentEvent = {
      type: chosen.type,
      label: chosen.label,
      duration,
      framesLeft: duration,
      trendBias: chosen.trendBias * intensityVar,
      volMultiplier: 1 + (chosen.volMultiplier - 1) * intensityVar,
    };
    this.phaseTriggered.clear();
  }

  /** Returns extra trend bias from current event (0 if none) */
  getTrendBias(): number {
    return this.currentEvent?.trendBias ?? 0;
  }

  /** Returns volatility multiplier from current event (1 if none) */
  getVolMultiplier(): number {
    return this.currentEvent?.volMultiplier ?? 1;
  }

  /** Banner text for UI */
  getLabel(): string {
    if (!this.currentEvent) return '';
    const pct = Math.round(
      (this.currentEvent.framesLeft / this.currentEvent.duration) * 100
    );
    return `${this.currentEvent.label} [${pct}%]`;
  }
}
