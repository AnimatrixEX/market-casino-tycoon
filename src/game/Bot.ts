// Bot.ts — individual trading bot with simulated positions

export type BotType = 'basic' | 'scalper' | 'trend' | 'yolo' | 'grid' | 'sniper' | 'martingale' | 'quant' | 'hft' | 'arbitrage' | 'omega';

export interface BotConfig {
  type: BotType;
  label: string;
  baseCost: number;
  /** Frames between trade open attempts */
  tradeInterval: number;
  /** How many frames a position stays open */
  holdDuration: number;
  /** Max leverage the bot uses */
  leverage: number;
  /** Base profit per successful trade (fraction of notional) */
  baseProfitRate: number;
  /** Chance of liquidation per trade (0-1) */
  baseLiqRisk: number;
  /** Fraction of position lost on liquidation */
  liqLossFraction: number;
}

export const BOT_CONFIGS: Record<BotType, BotConfig> = {
  basic: {
    type: 'basic',
    label: 'Basic Bot',
    baseCost: 5000,
    tradeInterval: 300,   // ~5 sec
    holdDuration: 180,    // ~3 sec
    leverage: 2,
    baseProfitRate: 0.0013,
    baseLiqRisk: 0.02,
    liqLossFraction: 0.15,
  },
  scalper: {
    type: 'scalper',
    label: 'Scalper Bot',
    baseCost: 80_000,
    tradeInterval: 90,    // ~1.5 sec
    holdDuration: 45,     // ~0.75 sec
    leverage: 5,
    baseProfitRate: 0.001,
    baseLiqRisk: 0.06,
    liqLossFraction: 0.25,
  },
  trend: {
    type: 'trend',
    label: 'Trend Bot',
    baseCost: 500_000,
    tradeInterval: 360,   // ~6 sec
    holdDuration: 300,    // ~5 sec
    leverage: 8,
    baseProfitRate: 0.004,
    baseLiqRisk: 0.08,
    liqLossFraction: 0.3,
  },
  yolo: {
    type: 'yolo',
    label: 'YOLO Bot',
    baseCost: 50_000_000,
    tradeInterval: 480,   // ~8 sec
    holdDuration: 240,    // ~4 sec
    leverage: 30,
    baseProfitRate: 0.007,
    baseLiqRisk: 0.25,
    liqLossFraction: 0.4,
  },
  grid: {
    type: 'grid',
    label: 'Grid Bot',
    baseCost: 50_000,
    tradeInterval: 180,   // ~3 sec
    holdDuration: 120,    // ~2 sec
    leverage: 3,
    baseProfitRate: 0.001,
    baseLiqRisk: 0.01,
    liqLossFraction: 0.08,
  },
  sniper: {
    type: 'sniper',
    label: 'Sniper Bot',
    baseCost: 5_000_000,
    tradeInterval: 600,   // ~10 sec
    holdDuration: 120,    // ~2 sec
    leverage: 12,
    baseProfitRate: 0.017,
    baseLiqRisk: 0.04,
    liqLossFraction: 0.2,
  },
  martingale: {
    type: 'martingale',
    label: 'Martingale Bot',
    baseCost: 1_000_000_000,
    tradeInterval: 300,   // ~5 sec
    holdDuration: 180,    // ~3 sec
    leverage: 20,
    baseProfitRate: 0.01,
    baseLiqRisk: 0.18,
    liqLossFraction: 0.3,
  },
  quant: {
    type: 'quant',
    label: 'Quant Bot',
    baseCost: 50_000_000_000,
    tradeInterval: 420,   // ~7 sec
    holdDuration: 240,    // ~4 sec
    leverage: 15,
    baseProfitRate: 0.01,
    baseLiqRisk: 0.03,
    liqLossFraction: 0.15,
  },
  hft: {
    type: 'hft',
    label: 'HFT Bot',
    baseCost: 5_000_000_000_000,
    tradeInterval: 30,    // ~0.5 sec — ultra-fast
    holdDuration: 15,     // ~0.25 sec
    leverage: 25,
    baseProfitRate: 0.00067,
    baseLiqRisk: 0.07,
    liqLossFraction: 0.3,
  },
  arbitrage: {
    type: 'arbitrage',
    label: 'Arbitrage Bot',
    baseCost: 1_000_000_000_000_000,
    tradeInterval: 240,   // ~4 sec
    holdDuration: 120,    // ~2 sec
    leverage: 10,
    baseProfitRate: 0.02,
    baseLiqRisk: 0.015,
    liqLossFraction: 0.1,
  },
  omega: {
    type: 'omega',
    label: 'Omega Bot',
    baseCost: 500_000_000_000_000_000,
    tradeInterval: 720,   // ~12 sec
    holdDuration: 360,    // ~6 sec
    leverage: 50,
    baseProfitRate: 0.033,
    baseLiqRisk: 0.05,
    liqLossFraction: 0.25,
  },
};

export interface BotState {
  id: number;
  type: BotType;
  /** Frames until next trade attempt */
  cooldown: number;
  /** Whether the bot currently has a simulated open position */
  inTrade: boolean;
  /** Frames remaining in current trade */
  tradeFramesLeft: number;
  /** Entry price of current simulated position */
  entryPrice: number;
  /** Side of current simulated position */
  side: 'long' | 'short';
  /** Total profit earned by this bot (lifetime) */
  totalProfit: number;
  /** Profit earned in the last completed trade */
  lastTradePnl: number;
  /** Whether the bot is alive (not liquidated) */
  alive: boolean;
}

let nextBotId = 1;

export class Bot {
  public state: BotState;
  public config: BotConfig;

  constructor(type: BotType) {
    this.config = BOT_CONFIGS[type];
    this.state = {
      id: nextBotId++,
      type,
      // Start with full cooldown so bots don't all fire on first frame after load
      cooldown: this.config.tradeInterval + Math.floor(Math.random() * 60),
      inTrade: false,
      tradeFramesLeft: 0,
      entryPrice: 0,
      side: 'long',
      totalProfit: 0,
      lastTradePnl: 0,
      alive: true,
    };
  }

  /**
   * Tick the bot. Returns PnL realized this frame (0 most frames).
   * marketPrice: current price
   * marketTrend: current trend direction (-1 to 1) for trend bot
   * profitMult: global profit multiplier from upgrades/prestige
   * liqReduction: liquidation risk reduction (0-1 scale, 0 = no reduction)
   * speedMult: speed multiplier (lower = faster trades)
   */
  tick(
    marketPrice: number,
    marketTrend: number,
    profitMult: number,
    liqReduction: number,
    speedMult: number,
    holdMult: number = 1,
    liqRiskMult: number = 1,
    botMult: number = 1
  ): number {
    if (!this.state.alive) return 0;

    let realized = 0;

    if (this.state.inTrade) {
      this.state.tradeFramesLeft--;

      if (this.state.tradeFramesLeft <= 0) {
        // Close trade — determine outcome
        realized = this.resolveTrade(marketPrice, profitMult, liqReduction, liqRiskMult, botMult);
        this.state.inTrade = false;
        this.state.cooldown = Math.floor(this.config.tradeInterval * speedMult);
      }
    } else {
      this.state.cooldown--;
      if (this.state.cooldown <= 0) {
        this.openTrade(marketPrice, marketTrend, holdMult);
      }
    }

    return realized;
  }

  private openTrade(marketPrice: number, marketTrend: number, holdMult: number): void {
    this.state.inTrade = true;
    this.state.tradeFramesLeft = Math.max(10, Math.floor(this.config.holdDuration * holdMult));
    this.state.entryPrice = marketPrice;

    // Decide side based on bot type
    if (this.config.type === 'trend' || this.config.type === 'sniper' || this.config.type === 'quant') {
      // Follow the trend
      this.state.side = marketTrend >= 0 ? 'long' : 'short';
    } else if (this.config.type === 'grid') {
      // Alternate sides for grid trading
      this.state.side = this.state.side === 'long' ? 'short' : 'long';
    } else {
      // Random side
      this.state.side = Math.random() > 0.5 ? 'long' : 'short';
    }
  }

  private resolveTrade(
    marketPrice: number,
    profitMult: number,
    liqReduction: number,
    liqRiskMult: number = 1,
    botMult: number = 1
  ): number {
    const { entryPrice, side } = this.state;

    // Guard: if entry price is invalid (e.g. 0 after reload), skip this trade
    if (!entryPrice || entryPrice <= 0 || !isFinite(entryPrice)) {
      this.state.lastTradePnl = 0;
      return 0;
    }

    const priceDelta = marketPrice - entryPrice;
    const direction = side === 'long' ? 1 : -1;
    const rawReturn = (priceDelta / entryPrice) * direction * this.config.leverage;

    // Check for liquidation — smooth probability, no hard threshold
    const effectiveLiqRisk = this.config.baseLiqRisk * (1 - liqReduction) * liqRiskMult;
    const adversity = rawReturn < 0 ? Math.min(3, 1 + Math.abs(rawReturn)) : 0.3;
    if (Math.random() < effectiveLiqRisk * adversity) {
      // Liquidated — loss capped at 2× a normal winning trade so bots stay net positive
      const normalProfit = this.config.baseCost * this.config.baseProfitRate * profitMult;
      const loss = -Math.min(this.config.baseCost * this.config.liqLossFraction, normalProfit * 2);
      this.state.lastTradePnl = loss;
      this.state.totalProfit += loss;
      return loss;
    }

    // Normal trade resolution — bots only benefit from 10% of the profitMult bonus
    // so manual trading always remains the dominant income source
    const botProfitMult = (1 + (profitMult - 1) * 0.1) * botMult;
    const baseProfit = this.config.baseCost * this.config.baseProfitRate;
    let profit = baseProfit * botProfitMult;

    // Clamp minimum loss
    if (profit < -this.config.baseCost * 0.1) {
      profit = -this.config.baseCost * 0.1;
    }

    this.state.lastTradePnl = profit;
    this.state.totalProfit += profit;
    return profit;
  }

  /** Estimated profit per second at 60fps */
  estimatedPps(profitMult: number, speedMult: number): number {
    const cycleFrames = (this.config.tradeInterval * speedMult) + this.config.holdDuration;
    const tradesPerSec = 60 / cycleFrames;
    const botProfitMult = 1 + (profitMult - 1) * 0.1;
    const avgProfit = this.config.baseCost * this.config.baseProfitRate * botProfitMult * 0.7;
    return avgProfit * tradesPerSec;
  }

  static resetIdCounter(): void {
    nextBotId = 1;
  }
}
