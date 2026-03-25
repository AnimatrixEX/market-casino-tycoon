// TradeSystem.ts — position management, PnL, and liquidation logic

import { Player } from './Player';

export type PositionSide = 'long' | 'short';

export interface TradeRecord {
  assetId: string;
  assetLabel: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  leverage: number;
  closedAt: number;
  wasLiquidated: boolean;
}

export interface Position {
  side: PositionSide;
  entryPrice: number;
  /** Notional size = balance * leverage (at time of open) */
  size: number;
  /** Collateral locked for this position */
  collateral: number;
  leverage: number;
  /** Price at which position is forcibly closed */
  liquidationPrice: number;
}

export class TradeSystem {
  public position: Position | null = null;

  openPosition(side: PositionSide, player: Player, currentPrice: number, collateralOverride?: number): void {
    if (this.position) return; // already in a trade

    const collateral = collateralOverride !== undefined ? collateralOverride : player.balance;
    const size = collateral * player.leverage;

    // Liquidation: position is wiped when collateral is gone.
    // For a long: liqPrice = entry * (1 - 1/leverage)
    // For a short: liqPrice = entry * (1 + 1/leverage)
    const liqOffset = currentPrice / player.leverage;
    const liquidationPrice =
      side === 'long'
        ? currentPrice - liqOffset
        : currentPrice + liqOffset;

    this.position = {
      side,
      entryPrice: currentPrice,
      size,
      collateral,
      leverage: player.leverage,
      liquidationPrice,
    };
  }

  closePosition(player: Player, currentPrice: number, profitMult = 1.0): number {
    if (!this.position) return 0;

    const rawPnl = this.calculatePnL(currentPrice);
    // profitMult only amplifies gains — losses are capped at -collateral
    const pnl = rawPnl >= 0
      ? rawPnl * profitMult
      : Math.max(rawPnl, -this.position.collateral);
    player.applyPnL(pnl);
    this.position = null;
    return pnl;
  }

  /**
   * Returns unrealised PnL based on current price.
   * PnL = size * (priceChange / entryPrice)
   */
  calculatePnL(currentPrice: number): number {
    if (!this.position) return 0;
    const { side, entryPrice, size } = this.position;
    const priceDelta = currentPrice - entryPrice;
    const pnl = side === 'long'
      ? (priceDelta / entryPrice) * size
      : (-priceDelta / entryPrice) * size;
    return pnl;
  }

  /**
   * Returns PnL as a fraction of collateral (-1 = full liquidation).
   */
  getPnLRatio(currentPrice: number): number {
    if (!this.position) return 0;
    return this.calculatePnL(currentPrice) / this.position.collateral;
  }

  /**
   * Checks whether current price has crossed the liquidation level.
   */
  isLiquidated(currentPrice: number): boolean {
    if (!this.position) return false;
    const { side, liquidationPrice } = this.position;
    if (side === 'long'  && currentPrice <= liquidationPrice) return true;
    if (side === 'short' && currentPrice >= liquidationPrice) return true;
    return false;
  }

  reset(): void {
    this.position = null;
  }
}
