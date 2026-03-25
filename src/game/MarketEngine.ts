// MarketEngine.ts — simulated price driven by trend + noise + volatility

import { EventSystem } from './EventSystem';
import type { NewsTicker } from './NewsTicker';
import type { AssetConfig } from './AssetConfig';

// How many price samples to keep in history (the chart)
const HISTORY_LENGTH = 300;

export class MarketEngine {
  public price: number;
  /** Ring buffer for price history — use getHistory() to read */
  public priceHistory: Float64Array;
  private histHead = 0;   // next write position
  private histLen = 0;    // how many entries are filled

  // Slow trend component (-1 … +1, drifts gradually)
  private trend = 0;
  // Base volatility (% of price per frame)
  private baseVol: number;
  // Trend momentum
  private trendMomentum = 0;

  /** Chart line color for this asset */
  public color: string;

  /** Overall speed multiplier — scaled by prestige in Game.ts */
  public speedMult: number = 0.25;

  /** Record a chart sample every N ticks (higher = slower scrolling chart) */
  public sampleInterval: number = 6;
  private sampleCounter = 0;

  private events: EventSystem;
  public newsTicker: NewsTicker | null = null;

  constructor(startPrice: number, events: EventSystem, asset?: AssetConfig) {
    this.price = startPrice;
    this.events = events;
    this.baseVol = asset?.baseVol ?? 0.0008;
    this.color = asset?.color ?? '#3399ff';
    this.priceHistory = new Float64Array(HISTORY_LENGTH);
    // Pre-fill history so the chart isn't empty on start
    this.priceHistory.fill(startPrice);
    this.histLen = HISTORY_LENGTH;
    this.histHead = 0;
  }

  /** Read price at logical index i (0 = oldest) */
  getPrice(i: number): number {
    const idx = (this.histHead + i) % HISTORY_LENGTH;
    return this.priceHistory[idx];
  }

  /** Number of valid history entries */
  get historyLength(): number {
    return this.histLen;
  }

  tick(): void {
    // --- Trend drift (random walk with momentum, speed scales with asset volatility + prestige) ---
    const volScale = this.baseVol / 0.0008; // 1.0 = BTC baseline
    this.trendMomentum += (Math.random() - 0.5) * 0.02 * volScale * this.speedMult;
    this.trendMomentum *= 0.93;
    this.trend += this.trendMomentum;
    this.trend = Math.max(-1, Math.min(1, this.trend));

    // --- Event modifiers ---
    const eventBias = this.events.getTrendBias();
    const volMult   = this.events.getVolMultiplier();

    // --- News nudge modifiers ---
    const newsBias = this.newsTicker?.getNudgeBias() ?? 0;
    const newsVol  = this.newsTicker?.getNudgeVolMult() ?? 1;

    // --- Effective volatility ---
    const vol = this.baseVol * volMult * newsVol;

    // --- Price step ---
    const trendStep = this.trend * this.price * this.baseVol * 0.375 * this.speedMult;
    const biasStep  = (eventBias + newsBias) * this.price * 0.0012;
    const noiseStep = gaussianRand() * this.price * vol * Math.sqrt(this.speedMult);

    this.price += trendStep + biasStep + noiseStep;

    // Keep price from going below $1
    if (this.price < 1) this.price = 1;

    // Record history at reduced rate for slower chart scrolling
    this.sampleCounter++;
    if (this.sampleCounter >= this.sampleInterval) {
      this.sampleCounter = 0;
      this.priceHistory[this.histHead] = this.price;
      this.histHead = (this.histHead + 1) % HISTORY_LENGTH;
      if (this.histLen < HISTORY_LENGTH) this.histLen++;
    }
  }

  /** Current volatility expressed as a percentage */
  get volatilityPct(): number {
    return this.baseVol * this.events.getVolMultiplier() * 100;
  }
}

/** Box-Muller transform for Gaussian noise */
function gaussianRand(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
