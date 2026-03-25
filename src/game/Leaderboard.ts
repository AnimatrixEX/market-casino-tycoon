// Leaderboard.ts — server-side leaderboard via /api/leaderboard
// Falls back to localStorage if the API is unreachable.

export interface LeaderboardEntry {
  name:     string;
  balance:  number;
  prestige: number;
  title:    string;
  date:     number;
}

const API        = '/api/leaderboard';
const LS_FALLBACK = 'mct_leaderboard_v1';
const MAX_ENTRIES = 20;

export class Leaderboard {
  private cache: LeaderboardEntry[] = [];
  public latencyMs: number = -1;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Seed cache from localStorage while the first fetch is in flight
    try {
      const raw = localStorage.getItem(LS_FALLBACK);
      if (raw) this.cache = JSON.parse(raw);
    } catch {}
    this.refresh();
    this.startPing();
  }

  private startPing(): void {
    const doPing = async () => {
      try {
        const t0 = performance.now();
        const res = await fetch(API + '?ping=1', { method: 'HEAD' });
        if (res.ok || res.status === 405) {
          this.latencyMs = Math.round(performance.now() - t0);
        }
      } catch {
        this.latencyMs = -1;
      }
    };
    doPing();
    this.pingInterval = setInterval(doPing, 5000);
  }

  /** Fetch latest entries from the server and refresh the cache. */
  async refresh(): Promise<void> {
    try {
      const res = await fetch(API);
      if (res.ok) this.cache = await res.json();
    } catch {
      // API unreachable — keep localStorage fallback
    }
  }

  /**
   * Submit a new entry (called on prestige).
   * Optimistic-updates the cache immediately.
   */
  async submit(name: string, balance: number, prestige: number, title: string): Promise<void> {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, balance, prestige, title }),
      });
      if (res.ok) this.cache = await res.json();
    } catch {
      // Fallback: update locally with deduplication
      const key = name.toLowerCase();
      const idx = this.cache.findIndex(e => e.name.toLowerCase() === key);
      const entry: LeaderboardEntry = { name, balance, prestige, title, date: Date.now() };
      if (idx !== -1) {
        const prev = this.cache[idx];
        if (prestige > prev.prestige || (prestige === prev.prestige && balance > prev.balance)) {
          this.cache[idx] = entry;
        }
      } else {
        this.cache.push(entry);
      }
      this.cache = this._sorted(this.cache).slice(0, MAX_ENTRIES);
      try { localStorage.setItem(LS_FALLBACK, JSON.stringify(this.cache)); } catch {}
    }
  }

  /** Clear all records. */
  async clear(): Promise<void> {
    this.cache = [];
    try {
      await fetch(API, { method: 'DELETE' });
    } catch {
      try { localStorage.removeItem(LS_FALLBACK); } catch {}
    }
  }

  /** Synchronous read of the cached entries (used by the render loop). */
  getEntries(): LeaderboardEntry[] {
    return this.cache;
  }

  private _sorted(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return [...entries].sort((a, b) =>
      b.prestige !== a.prestige ? b.prestige - a.prestige : b.balance - a.balance
    );
  }
}
