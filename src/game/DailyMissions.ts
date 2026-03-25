// DailyMissions.ts — daily objectives that refresh every 24h

const MISSIONS_KEY = 'mct_daily_missions';

export type MissionType =
  | 'profit_trades'
  | 'bot_earn'
  | 'lev_trade'
  | 'multi_asset'
  | 'balance'
  | 'big_trade'
  | 'trade_volume'
  | 'upgrade_buy'
  | 'bot_buy'
  | 'lev_profit';

export interface Mission {
  type: MissionType;
  label: string;
  target: number;
  progress: number;
  reward: number;
  done: boolean;
  completedAt?: number;
}

interface MissionsSave {
  date: string;
  missions: Mission[];
  assetsTraded: string[];
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtM(n: number): string {
  if (n >= 1e18) return `$${(n / 1e18).toFixed(1)}Qi`;
  if (n >= 1e15) return `$${(n / 1e15).toFixed(1)}Qa`;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export class DailyMissions {
  public missions: Mission[] = [];
  private assetsTraded: Set<string> = new Set();

  init(prestigeCount: number, debtThreshold: number): void {
    const today = todayKey();
    try {
      const raw = localStorage.getItem(MISSIONS_KEY);
      if (raw) {
        const saved: MissionsSave = JSON.parse(raw);
        if (saved.date === today) {
          this.missions = saved.missions;
          this.assetsTraded = new Set(saved.assetsTraded ?? []);
          return;
        }
      }
    } catch {}
    this.missions = this.generate(prestigeCount, debtThreshold);
    this.assetsTraded = new Set();
    this.persist(today);
  }

  /** Call when closing a trade in profit. Returns total reward earned. */
  onProfitableTrade(pnl: number, leverage: number): number {
    let reward = this.addProgress('profit_trades', 1);
    // big_trade: single trade profit > target
    for (const m of this.missions) {
      if (m.type === 'big_trade' && !m.done && pnl >= m.target) {
        m.done = true;
        m.progress = m.target;
        m.completedAt = Date.now();
        reward += m.reward;
        this.persist(todayKey());
      }
    }
    // lev_profit: profitable trade at leverage >= target
    for (const m of this.missions) {
      if (m.type === 'lev_profit' && !m.done && leverage >= m.target) {
        m.done = true;
        m.progress = m.target;
        m.completedAt = Date.now();
        reward += m.reward;
        this.persist(todayKey());
      }
    }
    if (reward > 0) this.persist(todayKey());
    return reward;
  }

  /** Call each frame with positive bot earnings. */
  onBotEarnings(amount: number): number {
    if (amount <= 0) return 0;
    return this.addProgress('bot_earn', amount);
  }

  /** Call when opening any trade. */
  onTradeOpened(leverage: number): number {
    let reward = this.addProgress('trade_volume', 1);
    // lev_trade: open at leverage >= target
    for (const m of this.missions) {
      if (m.type === 'lev_trade' && !m.done && leverage >= m.target) {
        m.done = true;
        m.progress = m.target;
        m.completedAt = Date.now();
        reward += m.reward;
        this.persist(todayKey());
      }
    }
    return reward;
  }

  /** Call when opening a position on an asset. */
  onAssetTraded(assetId: string): number {
    if (this.assetsTraded.has(assetId)) return 0;
    this.assetsTraded.add(assetId);
    const reward = this.addProgress('multi_asset', 1);
    if (reward === 0) this.persist(todayKey());
    return reward;
  }

  /** Call each frame with current balance. */
  onBalanceCheck(balance: number): number {
    for (const m of this.missions) {
      if (m.type === 'balance' && !m.done && balance >= m.target) {
        m.done = true;
        m.progress = m.target;
        m.completedAt = Date.now();
        this.persist(todayKey());
        return m.reward;
      }
    }
    return 0;
  }

  /** Call when buying an upgrade. */
  onUpgradeBought(): number {
    return this.addProgress('upgrade_buy', 1);
  }

  /** Call when buying a bot. */
  onBotBought(): number {
    return this.addProgress('bot_buy', 1);
  }

  get completedCount(): number {
    return this.missions.filter(m => m.done).length;
  }

  get allDone(): boolean {
    return this.missions.length > 0 && this.missions.every(m => m.done);
  }

  private addProgress(type: MissionType, amount: number): number {
    let reward = 0;
    for (const m of this.missions) {
      if (m.type !== type || m.done) continue;
      m.progress = Math.min(m.target, m.progress + amount);
      if (m.progress >= m.target) {
        m.done = true;
        m.completedAt = Date.now();
        reward += m.reward;
      }
    }
    if (reward > 0) this.persist(todayKey());
    return reward;
  }

  private persist(date: string): void {
    try {
      localStorage.setItem(MISSIONS_KEY, JSON.stringify({
        date,
        missions: this.missions,
        assetsTraded: [...this.assetsTraded],
      } as MissionsSave));
    } catch {}
  }

  private generate(rank: number, threshold: number): Mission[] {
    const pool: MissionType[] = [
      'profit_trades', 'bot_earn', 'lev_trade', 'multi_asset', 'balance',
      'big_trade', 'trade_volume', 'upgrade_buy', 'bot_buy', 'lev_profit',
    ];
    const seed = parseInt(todayKey().replace(/-/g, ''), 10);
    const shuffled = [...pool].sort((a, b) => {
      const ha = Math.sin(seed + a.charCodeAt(0) + a.length) * 1e9;
      const hb = Math.sin(seed + b.charCodeAt(0) + b.length) * 1e9;
      return (ha - Math.floor(ha)) - (hb - Math.floor(hb));
    });
    return shuffled.slice(0, 3).map(t => this.missionFor(t, rank, threshold));
  }

  private missionFor(type: MissionType, rank: number, threshold: number): Mission {
    switch (type) {
      case 'profit_trades': {
        const count = Math.max(3, Math.min(20, 3 + rank * 2));
        return { type, label: `Close ${count} trades in profit`, target: count, progress: 0, reward: Math.round(threshold * 0.08), done: false };
      }
      case 'bot_earn': {
        const earn = Math.min(Math.round(threshold * 0.12), 1e18); // cap at $1Qi
        return { type, label: `Earn ${fmtM(earn)} from bots`, target: earn, progress: 0, reward: Math.round(threshold * 0.05), done: false };
      }
      case 'lev_trade': {
        const minLev = Math.max(5, Math.min(50, 5 + rank * 5));
        return { type, label: `Open a trade at ×${minLev}+ leverage`, target: minLev, progress: 0, reward: Math.round(threshold * 0.06), done: false };
      }
      case 'multi_asset': {
        const n = Math.min(4, 2 + Math.floor(rank / 3));
        return { type, label: `Trade ${n} different assets`, target: n, progress: 0, reward: Math.round(threshold * 0.07), done: false };
      }
      case 'balance': {
        const bal = Math.min(Math.round(threshold * 0.4), 1e18); // cap at $1Qi
        return { type, label: `Reach ${fmtM(bal)} balance`, target: bal, progress: 0, reward: Math.round(threshold * 0.04), done: false };
      }
      case 'big_trade': {
        const target = Math.min(Math.round(threshold * 0.05), 1e15); // cap at $1Qa
        return { type, label: `Win ${fmtM(target)} in a single trade`, target, progress: 0, reward: Math.round(threshold * 0.09), done: false };
      }
      case 'trade_volume': {
        const count = Math.max(5, Math.min(30, 5 + rank * 3));
        return { type, label: `Open ${count} trades`, target: count, progress: 0, reward: Math.round(threshold * 0.04), done: false };
      }
      case 'upgrade_buy': {
        const count = Math.max(1, Math.min(5, 1 + Math.floor(rank / 2)));
        return { type, label: `Buy ${count} upgrade${count > 1 ? 's' : ''}`, target: count, progress: 0, reward: Math.round(threshold * 0.06), done: false };
      }
      case 'bot_buy': {
        const count = Math.max(2, Math.min(10, 2 + rank));
        return { type, label: `Buy ${count} bots`, target: count, progress: 0, reward: Math.round(threshold * 0.05), done: false };
      }
      case 'lev_profit': {
        const minLev = Math.max(10, Math.min(50, 10 + rank * 5));
        return { type, label: `Win a trade at ×${minLev}+ leverage`, target: minLev, progress: 0, reward: Math.round(threshold * 0.10), done: false };
      }
    }
  }
}
