// PrestigeSystem.ts — debt repayment system with rank progression

export class PrestigeSystem {
  /** Number of debts repaid (= rank) */
  public prestigeCount = 0;

  /** Frames remaining on debt timer (only decrements while game runs) */
  public debtFrames = 0;

  /** Interest multiplier on the debt (starts at 1.0, grows over time) */
  public debtInterestMult = 1.0;

  private static readonly INTEREST_RATE_PER_MS = 0.02 / 60_000; // 2% per real minute

  /** Finance-world rank titles by prestige count */
  static readonly TITLES: string[] = [
    'Retail Trader',         // 0
    'Day Trader',            // 1
    'Swing Trader',          // 2
    'Prop Trader',           // 3
    'Hedge Fund Analyst',    // 4
    'Portfolio Manager',     // 5
    'Derivatives Trader',    // 6
    'Quant Researcher',      // 7
    'Market Maker',          // 8
    'Hedge Fund Manager',    // 9
    'Managing Director',     // 10
    'Goldman Partner',       // 11
    'Macro Strategist',      // 12
    'Central Banker',        // 13
    'Dark Pool Operator',    // 14
    'Market Manipulator',    // 15
    'Rothschild',            // 16
    'Illuminati',            // 17
    'Shadow Broker',         // 18
    'Sovereign Fund Lord',   // 19
    'Currency Assassin',     // 20
    'Systemic Risk',         // 21
    'Too Big To Fail',       // 22
    'The Invisible Hand',    // 23
    'Quantitative God',      // 24
    'Architect of Crashes',  // 25
    'Black Swan',            // 26
    'The Algorithm',         // 27
    'Omega Trader',          // 28
    'Singularity Capital',   // 29
    'God of Markets',        // 30
    'Cosmic Whale',          // 31
    'Galactic Banker',       // 32
    'Universal Reserve',     // 33
    'Multiversal Fund',      // 34
    'Quantum Overlord',      // 35
    'Void Arbitrageur',      // 36
    'Dark Matter Capital',   // 37
    'Entropy Trader',        // 38
    'Heat Death Broker',     // 39
    'The Last Bull',         // 40
    'Omega Point',           // 41
    'Beyond Infinity',       // 42
    'The Source Code',       // 43
    'End of Time Capital',   // 44+
  ];

  getPrestigeTitle(): string {
    const last = PrestigeSystem.TITLES.length - 1;
    return PrestigeSystem.TITLES[Math.min(this.prestigeCount, last)];
  }

  getNextTitle(): string {
    const last = PrestigeSystem.TITLES.length - 1;
    if (this.prestigeCount >= last) return PrestigeSystem.TITLES[last];
    return PrestigeSystem.TITLES[this.prestigeCount + 1];
  }

  isMaxTitle(): boolean {
    return this.prestigeCount >= PrestigeSystem.TITLES.length - 1;
  }

  /** Base debt amount for current rank */
  getPrestigeThreshold(): number {
    const n = this.prestigeCount;
    const raw = 100_000 * Math.pow(3 + n * 0.1, n);
    return Math.min(raw, 999e33); // cap at $999De (max display scale before ∞)
  }

  /** Current debt with accrued interest (no-op at 999De cap) */
  getEffectiveThreshold(): number {
    const base = this.getPrestigeThreshold();
    if (base >= 999e33) return 999e33;
    return base * this.debtInterestMult;
  }

  /** Accrue interest each tick. Disabled once base debt is already at display cap (999De). */
  tickInterest(elapsedMs: number): void {
    if (elapsedMs <= 0 || this.getPrestigeThreshold() >= 999e33) return;
    this.debtInterestMult += elapsedMs * PrestigeSystem.INTEREST_RATE_PER_MS * this.debtInterestMult;
  }

  /** Duration in frames (60fps): 10 min + 2 min per rank */
  /** Duration decreases with rank: 20 min at R0, -30s per rank, minimum 3 min */
  getDebtDuration(count: number = this.prestigeCount): number {
    const minutes = Math.max(3, 20 - count * 0.5);
    return Math.round(minutes * 60 * 60); // frames at 60fps
  }

  /** Start (or restart) the debt countdown, with optional time multiplier */
  startDebt(timeMult = 1): void {
    this.debtFrames = this.getDebtDuration() * timeMult;
  }

  /** Milliseconds remaining (for display) */
  get debtMsRemaining(): number {
    return (this.debtFrames / 60) * 1000;
  }

  /** Decrement timer by real elapsed ms. Returns true if just expired. */
  tickDebtMs(elapsedMs: number): boolean {
    if (this.debtFrames <= 0) return false;
    // Convert ms to 60fps-equivalent frames for consistent saves/display
    const frames = elapsedMs * 60 / 1000;
    this.debtFrames = Math.max(0, this.debtFrames - frames);
    return this.debtFrames === 0;
  }

  /** True when timer has hit zero */
  get debtExpired(): boolean {
    return this.debtFrames === 0;
  }

  canPrestige(currentBalance: number): boolean {
    return currentBalance >= this.getEffectiveThreshold();
  }

  /** Execute debt repayment — rank up, restart debt timer. */
  prestige(timeMult = 1): void {
    this.prestigeCount++;
    this.debtInterestMult = 1.0;
    this.startDebt(timeMult);
  }

  // --- Permanent bonuses from rank ---

  /** Global profit multiplier from rank (capped at 500×) */
  get profitMultiplier(): number {
    return Math.min(500, 1 + this.prestigeCount * 0.15);
  }

  /** Risk reduction from rank (capped at 50%) */
  get riskReduction(): number {
    return Math.min(0.5, this.prestigeCount * 0.02);
  }

  /** Starting balance doubles each rank */
  get startingBalance(): number {
    return Math.round(1000 * Math.pow(2, this.prestigeCount));
  }

  /** Max leverage unlocked by prestige: x5 base, +1 per prestige, cap at 50 */
  get maxLeverage(): number {
    return Math.min(50, 5 + this.prestigeCount);
  }

  /** Unlocked bot types based on prestige */
  get unlockedBotTypes(): string[] {
    const types = ['basic'];
    if (this.prestigeCount >= 1)  types.push('scalper');
    if (this.prestigeCount >= 1)  types.push('grid');
    if (this.prestigeCount >= 2)  types.push('trend');
    if (this.prestigeCount >= 4)  types.push('sniper');
    if (this.prestigeCount >= 6)  types.push('yolo');
    if (this.prestigeCount >= 9)  types.push('martingale');
    if (this.prestigeCount >= 12) types.push('quant');
    if (this.prestigeCount >= 15) types.push('hft');
    if (this.prestigeCount >= 18) types.push('arbitrage');
    if (this.prestigeCount >= 22) types.push('omega');
    return types;
  }

  getBotUnlockRequirement(type: string): { prestigeCount: number } {
    switch (type) {
      case 'basic':      return { prestigeCount: 0 };
      case 'scalper':    return { prestigeCount: 1 };
      case 'grid':       return { prestigeCount: 1 };
      case 'trend':      return { prestigeCount: 2 };
      case 'sniper':     return { prestigeCount: 4 };
      case 'yolo':       return { prestigeCount: 6 };
      case 'martingale': return { prestigeCount: 9 };
      case 'quant':      return { prestigeCount: 12 };
      case 'hft':        return { prestigeCount: 15 };
      case 'arbitrage':  return { prestigeCount: 18 };
      case 'omega':      return { prestigeCount: 22 };
      default:           return { prestigeCount: 999 };
    }
  }

  serialize(): { prestigeCount: number; debtFrames: number; debtInterestMult: number } {
    return {
      prestigeCount: this.prestigeCount,
      debtFrames: this.debtFrames,
      debtInterestMult: this.debtInterestMult,
    };
  }

  deserialize(data: { prestigeCount: number; debtFrames?: number; debtInterestMult?: number; influence?: number }): void {
    this.prestigeCount = data.prestigeCount ?? 0;
    const maxFrames = this.getDebtDuration();
    const saved = data.debtFrames ?? 0;
    this.debtFrames = saved > 0 ? Math.min(saved, maxFrames) : 0;
    if (this.debtFrames <= 0) this.startDebt();
    this.debtInterestMult = Math.max(1.0, data.debtInterestMult ?? 1.0);
  }
}
