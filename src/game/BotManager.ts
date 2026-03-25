// BotManager.ts — manages all trading bots, purchases, and aggregate stats

import { Bot, BotType, BOT_CONFIGS } from './Bot';
import { MarketEngine } from './MarketEngine';

export class BotManager {
  public bots: Bot[] = [];

  /** Profit earned by bots this frame (used for balance updates) */
  public framePnl = 0;

  /** Running total of all bot profit (for stats) */
  public totalBotProfit = 0;

  /** Rolling profit/sec estimate (smoothed) */
  public profitPerSecond = 0;
  private ppsAccumulator = 0;
  private ppsFrameCount = 0;

  /** Get the cost of the next bot of a given type (steep exponential scaling) */
  getCost(type: BotType): number {
    const owned = this.getCount(type);
    const base = BOT_CONFIGS[type].baseCost;
    return Math.floor(base * Math.pow(1.35, owned));
  }

  /** Cached bot counts per type (updated each tick) */
  private countCache: Map<BotType, number> = new Map();

  /** Get count of bots of a given type */
  getCount(type: BotType): number {
    return this.countCache.get(type) ?? 0;
  }

  private updateCountCache(): void {
    this.countCache.clear();
    for (const bot of this.bots) {
      const t = bot.state.type;
      this.countCache.set(t, (this.countCache.get(t) ?? 0) + 1);
    }
  }

  buyBot(type: BotType): Bot {
    const bot = new Bot(type);
    this.bots.push(bot);
    this.countCache.set(type, (this.countCache.get(type) ?? 0) + 1);
    return bot;
  }

  /**
   * Tick all bots. Returns total PnL realized this frame.
   */
  tick(market: MarketEngine, profitMult: number, liqReduction: number, speedMult: number, holdMult: number = 1, liqRiskMult: number = 1, botMult: number = 1): number {
    let totalPnl = 0;

    // Approximate market trend from recent price history (no allocation)
    const hLen = market.historyLength;
    const lookback = Math.min(30, hLen);
    const oldPrice = market.getPrice(hLen - lookback);
    const newPrice = market.getPrice(hLen - 1);
    const trend = oldPrice > 0 ? (newPrice - oldPrice) / oldPrice : 0;
    const normalizedTrend = Math.max(-1, Math.min(1, trend * 100));

    for (const bot of this.bots) {
      const pnl = bot.tick(market.price, normalizedTrend, profitMult, liqReduction, speedMult, holdMult, liqRiskMult, botMult);
      totalPnl += pnl;
    }

    this.framePnl = totalPnl;
    this.totalBotProfit += totalPnl;

    // Smooth PPS calculation (update every 60 frames = 1 sec)
    this.ppsAccumulator += totalPnl;
    this.ppsFrameCount++;
    if (this.ppsFrameCount >= 60) {
      this.profitPerSecond = this.profitPerSecond * 0.7 + this.ppsAccumulator * 0.3;
      this.ppsAccumulator = 0;
      this.ppsFrameCount = 0;
    }

    return totalPnl;
  }

  /** Cached estimated PPS (updated every 60 frames in tick) */
  private cachedEstPps = 0;

  /** Estimated total profit per second from all bots (cached) */
  estimatedTotalPps(profitMult: number, speedMult: number): number {
    // Only recalculate when PPS counter resets (every 60 frames)
    if (this.ppsFrameCount === 0) {
      let total = 0;
      for (const bot of this.bots) {
        if (bot.state.alive) {
          total += bot.estimatedPps(profitMult, speedMult);
        }
      }
      this.cachedEstPps = total;
    }
    return this.cachedEstPps;
  }

  /** Cancel all open bot positions without resolving PnL — called on asset switch */
  cancelAllTrades(): void {
    for (const bot of this.bots) {
      if (bot.state.inTrade) {
        bot.state.inTrade = false;
        bot.state.entryPrice = 0;
        bot.state.cooldown = bot.config.tradeInterval;
      }
    }
  }

  reset(): void {
    this.bots = [];
    this.framePnl = 0;
    this.totalBotProfit = 0;
    this.profitPerSecond = 0;
    this.ppsAccumulator = 0;
    this.ppsFrameCount = 0;
    Bot.resetIdCounter();
  }

  /** Serialize for save */
  serialize(): { types: BotType[]; totalProfit: number } {
    return {
      types: this.bots.map(b => b.state.type),
      totalProfit: this.totalBotProfit,
    };
  }

  /** Restore from save */
  deserialize(data: { types: BotType[]; totalProfit: number }): void {
    this.reset();
    for (const type of data.types) {
      this.buyBot(type);
    }
    this.totalBotProfit = data.totalProfit;
  }
}
