// UpgradeSystem.ts — perks earned at each rank-up (roguelite style)

export type UpgradeId =
  | 'profit_boost'
  | 'liq_shield'
  | 'speed_boost'
  | 'bot_efficiency'
  | 'news_insight'
  | 'insurance'
  | 'multi_trade'
  | 'cascade_income'
  | 'leverage_mastery'
  | 'algo_trading'
  | 'vol_harvest'
  | 'compound_engine'
  | 'debt_freeze'
  | 'leverage_up'
  | 'time_buffer'
  | 'pressure_trade'
  | 'diversity_bonus'
  | 'cold_blooded';

export type UpgradeCategory = 'income' | 'bots' | 'risk' | 'market';

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  description: string;
  icon: string;
  category: UpgradeCategory;
  /** Max times this perk can be picked in a single run */
  maxStack: number;
  /** Value added per pick */
  valuePerLevel: number;
  /** Minimum rank required to appear in the pool */
  prestigeRequired?: number;
}

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  profit_boost: {
    id: 'profit_boost',
    label: 'Profit Boost',
    description: '+10% bot profit',
    icon: 'INC',
    category: 'income',
    maxStack: 10,
    valuePerLevel: 0.10,
  },
  liq_shield: {
    id: 'liq_shield',
    label: 'Liq Shield',
    description: '-5% liquidation risk',
    icon: 'LIQ',
    category: 'risk',
    maxStack: 6,
    valuePerLevel: 0.05,
  },
  speed_boost: {
    id: 'speed_boost',
    label: 'Speed Boost',
    description: '-8% bot trade cooldown',
    icon: 'SPD',
    category: 'bots',
    maxStack: 8,
    valuePerLevel: 0.08,
  },
  bot_efficiency: {
    id: 'bot_efficiency',
    label: 'Bot Efficiency',
    description: '-10% bot purchase cost',
    icon: 'BOT',
    category: 'bots',
    maxStack: 5,
    valuePerLevel: 0.10,
  },
  news_insight: {
    id: 'news_insight',
    label: 'News Insight',
    description: '+15% profit from news events',
    icon: 'NEWS',
    category: 'market',
    maxStack: 6,
    valuePerLevel: 0.15,
    prestigeRequired: 1,
  },
  insurance: {
    id: 'insurance',
    label: 'Insurance',
    description: 'Recover 5% of losses on liquidation',
    icon: 'INS',
    category: 'risk',
    maxStack: 5,
    valuePerLevel: 0.05,
    prestigeRequired: 2,
  },
  multi_trade: {
    id: 'multi_trade',
    label: 'Fast Cycles',
    description: '-6% bot hold duration',
    icon: 'CYC',
    category: 'bots',
    maxStack: 6,
    valuePerLevel: 0.06,
    prestigeRequired: 1,
  },
  cascade_income: {
    id: 'cascade_income',
    label: 'Cascade Income',
    description: '+20% bot income',
    icon: 'CAS',
    category: 'income',
    maxStack: 6,
    valuePerLevel: 0.20,
    prestigeRequired: 2,
  },
  leverage_mastery: {
    id: 'leverage_mastery',
    label: 'Leverage Mastery',
    description: '+6% liquidation protection',
    icon: 'PROT',
    category: 'risk',
    maxStack: 5,
    valuePerLevel: 0.06,
    prestigeRequired: 3,
  },
  algo_trading: {
    id: 'algo_trading',
    label: 'Algo Trading',
    description: '+15% manual trade profit',
    icon: 'ALGO',
    category: 'market',
    maxStack: 5,
    valuePerLevel: 0.15,
    prestigeRequired: 5,
  },
  vol_harvest: {
    id: 'vol_harvest',
    label: 'Vol Harvest',
    description: '+30% income during flash events',
    icon: 'VOL',
    category: 'market',
    maxStack: 4,
    valuePerLevel: 0.30,
    prestigeRequired: 8,
  },
  compound_engine: {
    id: 'compound_engine',
    label: 'Compound Engine',
    description: '+25% all income',
    icon: 'CPD',
    category: 'income',
    maxStack: 3,
    valuePerLevel: 0.25,
    prestigeRequired: 12,
  },
  debt_freeze: {
    id: 'debt_freeze',
    label: 'Debt Freeze',
    description: '-10% debt interest rate',
    icon: 'FRZ',
    category: 'risk',
    maxStack: 5,
    valuePerLevel: 0.10,
    prestigeRequired: 1,
  },
  leverage_up: {
    id: 'leverage_up',
    label: 'Leverage Up',
    description: '+2 max leverage cap',
    icon: 'LEV',
    category: 'market',
    maxStack: 6,
    valuePerLevel: 2,
    prestigeRequired: 2,
  },
  time_buffer: {
    id: 'time_buffer',
    label: 'Time Buffer',
    description: '+10% debt timer (applied immediately)',
    icon: 'TMR',
    category: 'risk',
    maxStack: 5,
    valuePerLevel: 0.10,
  },
  pressure_trade: {
    id: 'pressure_trade',
    label: 'Pressure Trade',
    description: '+12% income while debt timer is active',
    icon: 'PRE',
    category: 'income',
    maxStack: 5,
    valuePerLevel: 0.12,
    prestigeRequired: 3,
  },
  diversity_bonus: {
    id: 'diversity_bonus',
    label: 'Diversity Bonus',
    description: '+8% bot income per unique bot type owned',
    icon: 'DIV',
    category: 'bots',
    maxStack: 4,
    valuePerLevel: 0.08,
    prestigeRequired: 4,
  },
  cold_blooded: {
    id: 'cold_blooded',
    label: 'Cold Blooded',
    description: '+10% manual trade profit',
    icon: 'TRD',
    category: 'market',
    maxStack: 5,
    valuePerLevel: 0.10,
  },
};

export class UpgradeSystem {
  public levels: Record<UpgradeId, number> = {
    profit_boost: 0,
    liq_shield: 0,
    speed_boost: 0,
    bot_efficiency: 0,
    news_insight: 0,
    insurance: 0,
    multi_trade: 0,
    cascade_income: 0,
    leverage_mastery: 0,
    algo_trading: 0,
    vol_harvest: 0,
    compound_engine: 0,
    debt_freeze: 0,
    leverage_up: 0,
    time_buffer: 0,
    pressure_trade: 0,
    diversity_bonus: 0,
    cold_blooded: 0,
  };

  getLevel(id: UpgradeId): number {
    return this.levels[id];
  }

  isMaxed(id: UpgradeId): boolean {
    return this.levels[id] >= UPGRADE_DEFS[id].maxStack;
  }

  /** Apply one pick of a perk. Returns true if applied. */
  applyPerk(id: UpgradeId): boolean {
    if (this.isMaxed(id)) return false;
    this.levels[id]++;
    return true;
  }

  /** Roll N unique perk choices for the current rank. */
  rollChoices(prestigeCount: number, count = 3): UpgradeId[] {
    const pool = (Object.keys(UPGRADE_DEFS) as UpgradeId[]).filter(id => {
      const def = UPGRADE_DEFS[id];
      return (def.prestigeRequired ?? 0) <= prestigeCount && !this.isMaxed(id);
    });
    // Fisher-Yates shuffle then take first N
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  // --- Computed multipliers ---

  /** Global profit multiplier from upgrades (>= 1.0) */
  get profitMultiplier(): number {
    return 1 + this.levels.profit_boost * UPGRADE_DEFS.profit_boost.valuePerLevel;
  }

  /** Liquidation risk reduction (0 to ~0.75) */
  get liqReduction(): number {
    return Math.min(0.75, this.levels.liq_shield * UPGRADE_DEFS.liq_shield.valuePerLevel);
  }

  /** Speed multiplier (lower = faster, floor 0.2) */
  get speedMultiplier(): number {
    const reduction = this.levels.speed_boost * UPGRADE_DEFS.speed_boost.valuePerLevel;
    return Math.max(0.2, 1 - reduction);
  }

  /** Bot cost discount multiplier (< 1.0 = cheaper) */
  get botCostMultiplier(): number {
    const reduction = this.levels.bot_efficiency * UPGRADE_DEFS.bot_efficiency.valuePerLevel;
    return Math.max(0.2, 1 - reduction);
  }

  /** News nudge profit multiplier (>= 1.0) */
  get newsInsightMultiplier(): number {
    return 1 + this.levels.news_insight * UPGRADE_DEFS.news_insight.valuePerLevel;
  }

  /** Fraction of losses recovered on liquidation (0 to 0.4) */
  get insuranceRecovery(): number {
    return Math.min(0.4, this.levels.insurance * UPGRADE_DEFS.insurance.valuePerLevel);
  }

  /** Bot hold duration multiplier (lower = faster, floor 0.3) */
  get holdDurationMultiplier(): number {
    const reduction = this.levels.multi_trade * UPGRADE_DEFS.multi_trade.valuePerLevel;
    return Math.max(0.3, 1 - reduction);
  }

  /** Extra bot income multiplier from cascade (>= 1.0) */
  get cascadeIncomeMultiplier(): number {
    return 1 + this.levels.cascade_income * UPGRADE_DEFS.cascade_income.valuePerLevel;
  }

  /** Extra liquidation protection from leverage mastery (stacks with liqReduction) */
  get leverageMasteryReduction(): number {
    return this.levels.leverage_mastery * UPGRADE_DEFS.leverage_mastery.valuePerLevel;
  }

  /** Manual trade profit multiplier from algo trading (>= 1.0) */
  get algoTradingMultiplier(): number {
    return 1 + this.levels.algo_trading * UPGRADE_DEFS.algo_trading.valuePerLevel;
  }

  /** Income multiplier during flash news events (>= 1.0) */
  get volHarvestMultiplier(): number {
    return 1 + this.levels.vol_harvest * UPGRADE_DEFS.vol_harvest.valuePerLevel;
  }

  /** Global income multiplier from compound engine (>= 1.0) */
  get compoundEngineMultiplier(): number {
    return 1 + this.levels.compound_engine * UPGRADE_DEFS.compound_engine.valuePerLevel;
  }

  /** Debt interest rate reduction (0 to 0.5) */
  get debtFreezeReduction(): number {
    return Math.min(0.5, this.levels.debt_freeze * UPGRADE_DEFS.debt_freeze.valuePerLevel);
  }

  /** Flat bonus added to max leverage cap */
  get leverageUpBonus(): number {
    return this.levels.leverage_up * UPGRADE_DEFS.leverage_up.valuePerLevel;
  }

  /** Income multiplier when debt timer is active (>= 1.0) */
  get pressureTradeMultiplier(): number {
    return 1 + this.levels.pressure_trade * UPGRADE_DEFS.pressure_trade.valuePerLevel;
  }

  /** Bot income bonus per unique bot type (per type multiplier) */
  get diversityBonusPerType(): number {
    return this.levels.diversity_bonus * UPGRADE_DEFS.diversity_bonus.valuePerLevel;
  }

  /** Manual trade profit multiplier from cold blooded (>= 1.0) */
  get coldBloodedMultiplier(): number {
    return 1 + this.levels.cold_blooded * UPGRADE_DEFS.cold_blooded.valuePerLevel;
  }

  reset(): void {
    for (const key of Object.keys(this.levels) as UpgradeId[]) {
      this.levels[key] = 0;
    }
  }

  serialize(): Record<UpgradeId, number> {
    return { ...this.levels };
  }

  deserialize(data: Record<UpgradeId, number>): void {
    for (const key of Object.keys(UPGRADE_DEFS) as UpgradeId[]) {
      this.levels[key] = data[key] ?? 0;
    }
  }
}
