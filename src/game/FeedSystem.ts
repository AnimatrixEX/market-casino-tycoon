// FeedSystem.ts — live social feed with real cross-client events via /api/feed

export type FeedMessageType = 'profit' | 'big_profit' | 'liquidation';

interface FeedMessage {
  id: number;
  text: string;
  type: FeedMessageType;
  lifeMs: number;    // ms remaining
  maxLifeMs: number; // total lifetime
}

const FEED_API = '/api/feed';
const FEED_MAX = 12;
const PROFIT_LIFETIME   = 6000;  // ms
const BIG_PROFIT_LIFETIME = 8000;
const LIQ_LIFETIME      = 8000;
const POLL_INTERVAL_MIN = 3000;   // ms — normal cadence
const POLL_INTERVAL_MAX = 15000;  // ms — backoff when server is busy
const MIN_PROFIT_DISPLAY = 1000;  // only show profits above this threshold

const GHOST_NAMES = [
  'Trader42', 'AlphaX', 'Nova', 'Whale99', 'DarkPool',
  'QuantX', 'MoonWolf', 'DegenApe', 'SigmaChad', 'BullRekt',
  'CryptoMax', 'BearHawk', 'OracleX', 'MacroBro', 'GridKing',
  'LiqBot', 'HFT_7', 'ArbiX', 'OmegaQ', 'RetailShill',
  'MegaWhale', 'VaultX', 'GhostTrader', 'FlashBot', 'YoloMax',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmtAmount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 999999e33) return '$\u221E';
  if (abs >= 1e33) return `$${(n / 1e33).toFixed(1)}De`;
  if (abs >= 1e30) return `$${(n / 1e30).toFixed(1)}No`;
  if (abs >= 1e27) return `$${(n / 1e27).toFixed(1)}Oc`;
  if (abs >= 1e24) return `$${(n / 1e24).toFixed(1)}Sp`;
  if (abs >= 1e21) return `$${(n / 1e21).toFixed(1)}Sx`;
  if (abs >= 1e18) return `$${(n / 1e18).toFixed(1)}Qi`;
  if (abs >= 1e15) return `$${(n / 1e15).toFixed(1)}Qa`;
  if (abs >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

let nextId = 1;

export class FeedSystem {
  private messages: FeedMessage[] = [];
  /** ms until next ghost event */
  private ghostCooldownMs = 1500;
  /** ms until next server poll */
  private pollCooldownMs = 500; // first poll soon
  /** current poll interval (adapts to server load) */
  private pollIntervalMs = POLL_INTERVAL_MIN;
  /** last server event id seen (for ?after= param) */
  private lastServerId = 0;
  /** AbortController for in-flight poll (prevents stacking) */
  private pollAbort: AbortController | null = null;
  /** ms until player can post another event to the feed */
  private playerCooldownMs = 0;
  /** player name set from Game, used in server submissions */
  private playerName = '';
  private dirty = false;

  // --- Public API ---

  setPlayerName(name: string): void {
    this.playerName = name;
  }

  addProfit(amount: number, playerName: string): void {
    if (amount < MIN_PROFIT_DISPLAY) return;
    if (this.playerCooldownMs > 0) return;
    const type: FeedMessageType = amount >= 5000 ? 'big_profit' : 'profit';
    const sign = amount >= 0 ? '+' : '';
    this.push(`${playerName} ${sign}${fmtAmount(amount)}`, type);
    this.submitToServer('profit', amount);
    this.playerCooldownMs = 10_000;
  }

  addLiquidation(playerName: string): void {
    if (this.playerCooldownMs > 0) return;
    this.push(`${playerName} LIQUIDATED`, 'liquidation');
    this.submitToServer('liquidation', 0);
    this.playerCooldownMs = 10_000;
  }

  private addGhostProfit(amount: number, name: string): void {
    const type: FeedMessageType = amount >= 5000 ? 'big_profit' : 'profit';
    this.push(`${name} +${fmtAmount(amount)}`, type);
  }

  private addGhostLiquidation(name: string): void {
    this.push(`${name} LIQUIDATED`, 'liquidation');
  }

  /** Add an event received from another client via the server. */
  private addServerEvent(name: string, type: 'profit' | 'liquidation', amount: number): void {
    if (type === 'liquidation') {
      this.push(`${name} LIQUIDATED`, 'liquidation');
    } else {
      if (amount < MIN_PROFIT_DISPLAY) return;
      const msgType: FeedMessageType = amount >= 5000 ? 'big_profit' : 'profit';
      this.push(`${name} +${fmtAmount(amount)}`, msgType);
    }
  }

  tick(deltaMs: number): void {
    // Player event cooldown
    if (this.playerCooldownMs > 0) this.playerCooldownMs -= deltaMs;

    // Decay lifetimes
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].lifeMs -= deltaMs;
      if (this.messages[i].lifeMs <= 0) {
        this.messages.splice(i, 1);
        this.dirty = true;
      }
    }

    // Ghost event generator
    this.ghostCooldownMs -= deltaMs;
    if (this.ghostCooldownMs <= 0) {
      this.spawnGhostEvent();
      // One ghost every 8–20 seconds
      this.ghostCooldownMs = 8000 + Math.random() * 12000;
    }

    // Server poll — skip when tab is hidden
    if (!document.hidden) {
      this.pollCooldownMs -= deltaMs;
      if (this.pollCooldownMs <= 0) {
        this.pollFromServer();
        this.pollCooldownMs = this.pollIntervalMs;
      }
    }
  }

  /**
   * Update the feed DOM element. Call each frame (no-ops when nothing changed).
   * For opacity fades, we update every frame regardless.
   */
  render(el: HTMLElement): void {
    if (this.dirty) {
      this.rebuildDOM(el);
      this.dirty = false;
    }
    // Update opacity on existing elements each frame for smooth fade
    this.updateOpacities(el);
  }

  // --- Private ---

  private push(text: string, type: FeedMessageType): void {
    const maxLife = type === 'profit' ? PROFIT_LIFETIME :
                    type === 'big_profit' ? BIG_PROFIT_LIFETIME : LIQ_LIFETIME;
    this.messages.unshift({
      id: nextId++,
      text,
      type,
      lifeMs: maxLife,
      maxLifeMs: maxLife,
    });
    // Trim to max
    if (this.messages.length > FEED_MAX) {
      this.messages.length = FEED_MAX;
    }
    this.dirty = true;
  }

  private spawnGhostEvent(): void {
    const roll = Math.random();
    if (roll < 0.20) {
      // Liquidation (20%)
      this.addGhostLiquidation(pick(GHOST_NAMES));
    } else {
      // Big profit only (80%)
      const amount = 2000 + Math.random() * 198_000;
      this.addGhostProfit(amount, pick(GHOST_NAMES));
    }
  }

  private rebuildDOM(el: HTMLElement): void {
    el.innerHTML = '';
    for (const msg of this.messages) {
      const div = document.createElement('div');
      div.className = 'feed-msg feed-' + msg.type;
      div.dataset.id = String(msg.id);

      const dot = document.createElement('span');
      dot.className = 'feed-dot';

      const text = document.createElement('span');
      text.className = 'feed-text';
      text.textContent = msg.text;

      div.appendChild(dot);
      div.appendChild(text);
      el.appendChild(div);

      // Trigger slide-in: next microtask so transition fires
      requestAnimationFrame(() => div.classList.add('feed-visible'));
    }
  }

  private updateOpacities(el: HTMLElement): void {
    const children = el.children;
    for (let i = 0; i < children.length; i++) {
      const div = children[i] as HTMLElement;
      const id = Number(div.dataset.id);
      const msg = this.messages.find(m => m.id === id);
      if (!msg) continue;
      const ratio = msg.lifeMs / msg.maxLifeMs;
      // Fade out in last 25% of lifetime
      const opacity = ratio < 0.25 ? ratio / 0.25 : 1;
      div.style.opacity = String(opacity.toFixed(3));
    }
  }

  private async submitToServer(type: 'profit' | 'liquidation', amount: number): Promise<void> {
    if (!this.playerName) return;
    try {
      await fetch(FEED_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.playerName, type, amount }),
      });
    } catch {
      // Silently ignore — feed is best-effort
    }
  }

  private async pollFromServer(): Promise<void> {
    // Abort any in-flight poll to avoid stacking requests
    if (this.pollAbort) this.pollAbort.abort();
    this.pollAbort = new AbortController();
    const signal = this.pollAbort.signal;

    try {
      const res = await fetch(`${FEED_API}?after=${this.lastServerId}`, { signal });
      if (!res.ok) {
        // Server busy (503) or error — back off
        this.pollIntervalMs = Math.min(POLL_INTERVAL_MAX, this.pollIntervalMs * 2);
        return;
      }
      const events: { id: number; name: string; type: 'profit' | 'liquidation'; amount: number }[] = await res.json();

      // Adaptive interval: back off when server is busy (many events), recover when quiet
      if (events.length >= 10) {
        this.pollIntervalMs = Math.min(POLL_INTERVAL_MAX, this.pollIntervalMs * 1.5);
      } else {
        this.pollIntervalMs = Math.max(POLL_INTERVAL_MIN, this.pollIntervalMs * 0.8);
      }

      for (const ev of events) {
        if (ev.id > this.lastServerId) this.lastServerId = ev.id;
        // Skip own events (already shown locally when submitted)
        if (ev.name.toLowerCase() === this.playerName.toLowerCase()) continue;
        this.addServerEvent(ev.name, ev.type, ev.amount);
      }
    } catch {
      // Silently ignore — aborted or server unreachable
    }
  }
}
