// Player.ts — player state: balance, leverage, and session stats

export class Player {
  public balance: number;
  public leverage: number = 1;
  public maxLeverage: number = 5;
  /** Fraction of balance to use as collateral (0.1 – 1.0) */
  public tradeSize: number = 1.0;

  // Track peak balance for stats
  public peakBalance: number;
  public startBalance: number;

  // Lifetime stats
  public totalEarned = 0;
  public totalLost = 0;
  public tradesWon = 0;
  public tradesLost = 0;

  constructor(startBalance = 1000) {
    this.balance = startBalance;
    this.startBalance = startBalance;
    this.peakBalance = startBalance;
  }

  adjustLeverage(delta: number): void {
    this.leverage = Math.max(1, Math.min(this.maxLeverage, this.leverage + delta));
  }

  applyPnL(pnl: number): void {
    this.balance += pnl;
    if (pnl > 0) {
      this.totalEarned += pnl;
      this.tradesWon++;
    } else {
      this.totalLost += Math.abs(pnl);
      this.tradesLost++;
    }
    if (this.balance > this.peakBalance) {
      this.peakBalance = this.balance;
    }
  }

  /** Add passive income from bots (no trade stats) */
  addPassiveIncome(amount: number): void {
    this.balance += amount;
    if (amount > 0) {
      this.totalEarned += amount;
    } else {
      this.totalLost += Math.abs(amount);
    }
    if (this.balance > this.peakBalance) {
      this.peakBalance = this.balance;
    }
  }

  reset(newStartBalance = 1000): void {
    this.balance = newStartBalance;
    this.startBalance = newStartBalance;
    this.peakBalance = newStartBalance;
    // leverage preserved across prestige
    this.totalEarned = 0;
    this.totalLost = 0;
    this.tradesWon = 0;
    this.tradesLost = 0;
  }
}
