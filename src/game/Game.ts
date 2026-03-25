// Game.ts — main loop, state machine, wires all systems together

import { MarketEngine } from './MarketEngine';
import { EventSystem } from './EventSystem';
import { Player } from './Player';
import { TradeSystem, PositionSide, TradeRecord } from './TradeSystem';
import { BotManager } from './BotManager';
import { BotType } from './Bot';
import { UpgradeSystem, UpgradeId } from './UpgradeSystem';
import { PrestigeSystem } from './PrestigeSystem';
import { SaveSystem } from './SaveSystem';
import { JuiceSystem } from './JuiceSystem';
import { SoundSystem } from './SoundSystem';
import { NewsTicker } from './NewsTicker';
import { Renderer } from './Renderer';
import { UI } from './UI';
import { AssetConfig, ASSETS, ASSET_MAP } from './AssetConfig';
import { Leaderboard } from './Leaderboard';
import { FeedSystem } from './FeedSystem';
import { TutorialSystem } from './TutorialSystem';
import { DailyMissions } from './DailyMissions';

type GameState = 'running' | 'liquidated';

const LIQ_WARNING_THRESHOLD = 0.08;
const PLAYER_NAME_KEY = 'mct_player_name';

function generateName(): string {
  const adj  = ['Bull', 'Bear', 'Moon', 'Dark', 'Quant', 'Algo', 'Macro', 'Rekt', 'Degen', 'Based', 'Sigma', 'Chad'];
  const noun = ['Trader', 'Whale', 'Hodler', 'Broker', 'Shark', 'Wolf', 'Oracle', 'Ape', 'Gigabrain'];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const n = noun[Math.floor(Math.random() * noun.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${a}${n}${num}`;
}

export class Game {
  private state: GameState = 'running';
  public currentAsset: AssetConfig = ASSETS[0]; // BTC by default

  public events: EventSystem;   // current asset's event system
  public eventPool: Map<string, EventSystem> = new Map();
  public market: MarketEngine;
  public marketPool: Map<string, MarketEngine> = new Map();
  public player: Player;
  public tradePool: Map<string, TradeSystem> = new Map();
  public tradeHistory: TradeRecord[] = [];
  private leveragePool: Map<string, number> = new Map();
  get trades(): TradeSystem { return this.tradePool.get(this.currentAsset.id)!; }
  public bots     = new BotManager();
  public upgrades = new UpgradeSystem();
  public prestige = new PrestigeSystem();
  public save     = new SaveSystem();
  public missions = new DailyMissions();
  public leaderboard = new Leaderboard();
  /** Simulated game time in minutes since midnight. 1 frame = 1 game minute (60× real speed). Starts at 09:00. */
  public gameMinutes = 9 * 60;
  public feed     = new FeedSystem();
  public juice    = new JuiceSystem();
  public sound    = new SoundSystem();
  public news     = new NewsTicker();
  private renderer: Renderer;
  public ui: UI;
  // Throttle liquidation warning sound
  private liqWarnCooldown = 0;
  // Leaderboard sync counter (same interval as auto-save: 180 frames)
  private lbSyncFrame = 0;
  // For debt timer: track real elapsed time per tick
  private lastTickMs = 0;

  private tutorial: TutorialSystem | null = null;
  /** true when name modal is showing and tutorial should start after */
  private tutorialPendingAfterName = false;

  // Track previous PnL for floating number spawning
  private prevPnl = 0;
  // Track rank-ready state to play sound only on transition
  private prevCanPrestige = false;
  private pnlAccum = 0;
  // Track event state for flash triggers
  private lastEventType: string | null = null;
  private lastFlashText: string = '';
  // Throttle bot juice effects
  private botFloatCooldown = 0;
  private botFloatAccum = 0;
  private missionBalanceFrame = 0;
  private botSoundCooldown = 0;
  private botPulseCooldown = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.player = new Player(1000);
    for (const a of ASSETS) {
      const ev = new EventSystem();
      this.eventPool.set(a.id, ev);
      const m = new MarketEngine(a.startPrice, ev, a);
      m.newsTicker = this.news;
      this.marketPool.set(a.id, m);
      this.tradePool.set(a.id, new TradeSystem());
    }
    this.events = this.eventPool.get(this.currentAsset.id)!;
    this.market = this.marketPool.get(this.currentAsset.id)!;
    this.news.assetId = this.currentAsset.id;
    this.renderer = new Renderer(canvas);
    this.ui = new UI();

    // Show name modal on first launch
    if (!localStorage.getItem(PLAYER_NAME_KEY)) {
      this.tutorialPendingAfterName = true;
      this.ui.showNameModal('', (name) => this.setPlayerName(name));
    }

    // Try loading save
    const gmOut = { value: 9 * 60 };
    const loaded = this.save.load(this.player, this.bots, this.upgrades, this.prestige, this.tradeHistory, gmOut);
    this.gameMinutes = gmOut.value;
    if (!loaded) {
      this.prestige.startDebt();
    }
    if (loaded) {
      this.updateEffectiveMaxLeverage();
      this.updateMarketSpeed();
      const idle = this.save.getIdleEarnings(this.bots, this.upgrades, this.prestige);
      if (idle) {
        this.player.addPassiveIncome(idle.earnings);
        this.ui.showIdleSummary(idle.earnings, idle.elapsedSeconds, idle.botCount);
      }
    }

    this.missions.init(this.prestige.prestigeCount, this.prestige.getPrestigeThreshold());

    this.sizeCanvas();
    window.addEventListener('resize', () => this.sizeCanvas());
    // Re-size whenever the wrapper itself changes dimensions (mobile layout shifts)
    new ResizeObserver(() => this.sizeCanvas()).observe(this.renderer.canvas.parentElement!);

    this.ui.bindActions({
      onLong:    () => this.openPosition('long'),
      onShort:   () => this.closePosition(),
      onLevChange: (val: number) => { this.player.leverage = Math.max(1, Math.min(this.player.maxLeverage, val)); this.sound.leverageClick(); },
      onRestart: () => this.restartFromLiquidation(),
      onBuyBot:  (type: BotType) => this.buyBot(type),
      onSelectPerk: (id: UpgradeId) => this.applyPerk(id),
      onPrestige: () => this.doPrestige(),
      onToggleMute: () => this.sound.toggleMute(),
      onTabClick: () => this.sound.tabClick(),
      onSelectAsset: (id: string) => this.switchAsset(id),
      onNextAsset: () => {
        const unlocked = ASSETS.filter(a => this.prestige.prestigeCount >= a.prestigeRequired);
        const idx = unlocked.findIndex(a => a.id === this.currentAsset.id);
        const next = unlocked[(idx + 1) % unlocked.length];
        if (next) this.switchAsset(next.id);
      },
      onSizeChange: (pct: number) => { this.player.tradeSize = Math.max(0.1, Math.min(1, pct / 100)); },
      onClearLeaderboard: () => this.leaderboard.clear(),
      onSetName: (name: string) => this.setPlayerName(name),
      onRefreshLeaderboard: () => this.leaderboard.refresh(),
    });

    // Show tutorial for players who already have a name but haven't completed it
    if (!this.tutorialPendingAfterName && !TutorialSystem.isDone()) {
      setTimeout(() => this.startTutorial(), 400);
    }
  }

  start(): void {
    // Sync player name to feed system (may already be saved)
    this.feed.setPlayerName(this.playerName);
    // Reset elapsed timer when tab becomes visible to avoid giant debt tick
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.lastTickMs = 0;
    });
    this.loop();
  }

  private loop(): void {
    requestAnimationFrame(() => this.loop());

    if (this.state === 'running') {
      this.tick();
    }

    // Juice always updates (for animations to finish even when liquidated)
    const currentPnl = this.trades.position ? this.trades.calculatePnL(this.market.price) : 0;
    this.juice.tick(
      this.player.balance,
      currentPnl,
      this.market.price,
      this.isLiquidationApproaching()
    );

    this.draw();
  }

  private tick(): void {
    for (const [id, ev] of this.eventPool) {
      ev.tick();
      this.marketPool.get(id)!.tick();
    }
    this.news.tick(this.events.currentEvent?.type ?? null);


    // --- Event flash triggers ---
    const evType = this.events.currentEvent?.type ?? null;
    if (evType && evType !== this.lastEventType) {
      // New event just started
      // Bullish events
      if (evType === 'pump' || evType === 'fake_pump' || evType === 'whale_buy' || evType === 'short_squeeze' || evType === 'bull_trap') {
        const intensity = evType === 'short_squeeze' || evType === 'whale_buy' ? 0.2 : 0.15;
        const shake = evType === 'whale_buy' ? 6 : evType === 'short_squeeze' ? 5 : 4;
        this.juice.triggerFlash('#00d084', intensity, 15);
        this.renderer.triggerShake(shake, shake * 2);
        this.sound.eventPump();
      // Bearish events
      } else if (evType === 'crash' || evType === 'whale_sell' || evType === 'flash_crash' || evType === 'dead_cat_bounce') {
        const intensity = evType === 'flash_crash' ? 0.35 : evType === 'whale_sell' ? 0.22 : 0.2;
        const shake = evType === 'flash_crash' ? 10 : evType === 'whale_sell' ? 7 : 6;
        this.juice.triggerFlash('#ff2200', intensity, 18);
        this.renderer.triggerShake(shake, shake * 2);
        this.sound.eventCrash();
      // Volatility
      } else if (evType === 'volatility_spike') {
        this.juice.triggerFlash('#ffaa00', 0.12, 10);
        this.renderer.triggerShake(3, 6);
        this.sound.eventVolatility();
      }
    }
    this.lastEventType = evType;

    // --- Flash news sound ---
    const flash = this.news.activeFlash;
    if (flash && flash.text !== this.lastFlashText) {
      this.lastFlashText = flash.text;
      this.renderer.triggerShake(4, 10);
      if (flash.sentiment === 'bullish') this.sound.flashNewsBullish();
      else this.sound.flashNewsDanger();
    }
    if (!flash) this.lastFlashText = '';

    // --- Bots ---
    const newsBonus  = this.news.activeNudge ? this.upgrades.newsInsightMultiplier : 1;
    const flashBonus = this.news.activeFlash ? this.upgrades.volHarvestMultiplier : 1;
    const pressureMult = this.prestige.debtFrames > 0 ? this.upgrades.pressureTradeMultiplier : 1;
    const uniqueTypes = new Set(this.bots.bots.map(b => b.state.type)).size;
    const diversityMult = 1 + this.upgrades.diversityBonusPerType * uniqueTypes;
    const profitMult = this.upgrades.profitMultiplier * this.prestige.profitMultiplier
      * newsBonus * this.upgrades.cascadeIncomeMultiplier
      * this.upgrades.compoundEngineMultiplier * flashBonus * pressureMult * diversityMult;
    const liqReduc   = Math.min(0.9, this.upgrades.liqReduction + this.prestige.riskReduction + this.upgrades.leverageMasteryReduction);
    const speedMult  = this.upgrades.speedMultiplier;
    const holdMult   = this.upgrades.holdDurationMultiplier;

    const botPnl = this.bots.tick(this.market, profitMult, liqReduc, speedMult, holdMult);
    if (botPnl !== 0) {
      const clampedPnl = Math.max(botPnl, -this.player.balance);
      this.player.addPassiveIncome(clampedPnl);
      const botMissionReward = this.missions.onBotEarnings(botPnl);
      if (botMissionReward > 0) this.giveMissionReward(botMissionReward);

      // Accumulate bot PnL for batched floating text
      this.botFloatAccum += botPnl;

      // Throttled bot pulse (every 30 frames max)
      this.botPulseCooldown--;
      if (Math.abs(botPnl) > 0.5 && this.botPulseCooldown <= 0) {
        this.juice.triggerBotPulse();
        this.botPulseCooldown = 30;
      }

      // Throttled bot sound (every 90 frames max)
      this.botSoundCooldown--;
      if (botPnl > 10 && this.botSoundCooldown <= 0) {
        this.sound.botProfit();
        this.botSoundCooldown = 90;
      }

      // Batched floating number (every 60 frames, accumulates PnL)
      this.botFloatCooldown--;
      if (this.botFloatCooldown <= 0 && Math.abs(this.botFloatAccum) > 5) {
        const canvas = this.renderer.canvas;
        const x = canvas.width - 30;
        const y = canvas.height - 30 - Math.random() * 40;
        const color = this.botFloatAccum > 0 ? '#00d084' : '#ff4444';
        const sign = this.botFloatAccum > 0 ? '+' : '';
        this.juice.spawnFloatingText(`${sign}${formatCompact(this.botFloatAccum)}`, x, y, color, 11);
        this.botFloatAccum = 0;
        this.botFloatCooldown = 60;
      }
    }

    // --- Manual trade PnL floating numbers ---
    if (this.trades.position) {
      const pnl = this.trades.calculatePnL(this.market.price);
      const delta = pnl - this.prevPnl;
      this.pnlAccum += delta;
      this.prevPnl = pnl;

      // Spawn floating number when accumulated change is significant
      if (Math.abs(this.pnlAccum) > 20) {
        const canvas = this.renderer.canvas;
        const x = canvas.width * 0.7 + (Math.random() - 0.5) * 60;
        const y = 30 + Math.random() * 30;
        const color = this.pnlAccum > 0 ? '#00ff88' : '#ff3333';
        const sign = this.pnlAccum > 0 ? '+' : '';
        this.juice.spawnFloatingText(`${sign}${formatCompact(this.pnlAccum)}`, x, y, color, 14);
        this.pnlAccum = 0;
      }

      // Liquidation warning heartbeat
      if (this.isLiquidationApproaching()) {
        this.liqWarnCooldown--;
        if (this.liqWarnCooldown <= 0) {
          this.sound.liqWarningTick();
          this.liqWarnCooldown = 40;
        }
      } else {
        this.liqWarnCooldown = 0;
      }

      // Check liquidation for current asset (inside the "has position" block)


      // Extra shake during events when in position
      if (this.events.currentEvent) {
        const t = this.events.currentEvent.type;
        if (t === 'crash' || t === 'pump') {
          this.renderer.triggerShake(2, 2);
        }
      }
    } else {
      this.prevPnl = 0;
      this.pnlAccum = 0;
    }

    // --- Check ALL open positions for liquidation ---
    for (const [assetId, ts] of this.tradePool) {
      if (!ts.position) continue;
      const market = this.marketPool.get(assetId)!;
      if (ts.isLiquidated(market.price)) {
        this.liquidate(assetId);
        return;
      }
    }

    // --- Elapsed time (for feed tick) ---
    const now = performance.now();
    const elapsedMs = this.lastTickMs > 0 ? now - this.lastTickMs : 0;
    this.lastTickMs = now;

    // Advance simulated game clock: 1 game hour per 2 real minutes (1 day = 48 real minutes)
    const gmDelta = 1 / 120;
    this.gameMinutes += gmDelta;

    // --- Daily missions: balance check (every 60 frames) ---
    this.missionBalanceFrame = (this.missionBalanceFrame ?? 0) + 1;
    if (this.missionBalanceFrame >= 60) {
      this.missionBalanceFrame = 0;
      const balReward = this.missions.onBalanceCheck(this.player.balance);
      if (balReward > 0) this.giveMissionReward(balReward);
    }

    // --- Debt interest ---
    this.prestige.tickInterest(elapsedMs * (1 - this.upgrades.debtFreezeReduction));

    // --- Rank-ready sound (plays once on transition false → true) ---
    const canP = this.prestige.canPrestige(this.player.balance);
    if (canP && !this.prevCanPrestige) {
      this.sound.rankReady();
    }
    this.prevCanPrestige = canP;

    // --- Live feed ghost events ---
    this.feed.tick(elapsedMs > 0 ? elapsedMs : 16.7);

    // --- Auto-save + leaderboard sync ---
    this.save.tick(this.player, this.bots, this.upgrades, this.prestige, this.tradeHistory, this.gameMinutes);
    this.lbSyncFrame++;
    if (this.lbSyncFrame >= 180) {
      this.lbSyncFrame = 0;
      if (this.hasChosenName) {
        this.leaderboard.submit(this.playerName, this.player.balance, this.prestige.prestigeCount, this.prestige.getPrestigeTitle());
      }
    }
  }

  private feedEl: HTMLElement | null = document.getElementById('feed-panel');
  private pingDisplayFrame = 0;
  private pingEl: HTMLElement | null = document.getElementById('ping-display');

  private draw(): void {
    const approaching = this.isLiquidationApproaching();
    this.renderer.render(this.market, this.trades, approaching, this.juice);
    this.ui.update(this, this.juice);
    if (this.feedEl) this.feed.render(this.feedEl);
    this.pingDisplayFrame++;
    if (this.pingDisplayFrame >= 60 && this.pingEl) {
      this.pingDisplayFrame = 0;
      const ms = this.leaderboard.latencyMs;
      if (ms < 0) {
        this.pingEl.textContent = '— ms';
        this.pingEl.style.color = 'var(--text-faint)';
      } else {
        this.pingEl.textContent = ms + ' ms';
        this.pingEl.style.color = ms < 80 ? '#00d084' : ms < 200 ? '#f0c040' : '#ff4a4a';
      }
    }
  }

  // --- Actions ---

  private openPosition(side: PositionSide): void {
    if (this.state !== 'running') return;
    if (this.trades.position) return;
    if (this.player.balance <= 0) return;

    this.updateEffectiveMaxLeverage();
    const collateral = this.player.balance * this.player.tradeSize;
    this.trades.openPosition(side, this.player, this.market.price, collateral);

    // Daily missions
    const openReward  = this.missions.onTradeOpened(this.player.leverage);
    const assetReward = this.missions.onAssetTraded(this.currentAsset.id);
    if (openReward + assetReward > 0) this.giveMissionReward(openReward + assetReward);

    // Juice + sound feedback
    const color = side === 'long' ? '#00cc6a' : '#ff4444';
    this.juice.triggerFlash(color, 0.1, 8);
    this.renderer.triggerShake(2, 4);
    if (side === 'long') this.sound.openLong();
    else this.sound.openShort();
  }

  private closePosition(): void {
    if (!this.trades.position) return;
    const pos = this.trades.position;
    const side = pos.side;
    const entryPrice = pos.entryPrice;
    const leverage = pos.leverage;
    const exitPrice = this.market.price;
    const manualMult = this.currentAsset.profitMult
      * this.upgrades.algoTradingMultiplier
      * this.upgrades.coldBloodedMultiplier
      * this.upgrades.compoundEngineMultiplier
      * (this.news.activeFlash ? this.upgrades.volHarvestMultiplier : 1);
    const pnl = this.trades.closePosition(this.player, exitPrice, manualMult);
    this.tradeHistory.unshift({
      assetId: this.currentAsset.id, assetLabel: this.currentAsset.label,
      side, entryPrice, exitPrice, pnl, leverage, closedAt: Date.now(), wasLiquidated: false,
    });
    if (this.tradeHistory.length > 100) this.tradeHistory.pop();

    // Daily missions: profitable trade
    if (pnl > 0) {
      const tradeReward = this.missions.onProfitableTrade(pnl, leverage);
      if (tradeReward > 0) this.giveMissionReward(tradeReward);
    }

    // Juice + sound feedback based on PnL magnitude
    if (pnl > 0) {
      this.juice.triggerFlash('#00d084', Math.min(0.3, pnl / 500 * 0.2), 12);
      if (pnl > 100) this.renderer.triggerShake(3, 6);
      this.sound.closeProfit(pnl);
    } else {
      this.juice.triggerFlash('#ff2200', Math.min(0.3, Math.abs(pnl) / 500 * 0.2), 12);
      if (Math.abs(pnl) > 100) this.renderer.triggerShake(5, 8);
      this.sound.closeLoss(Math.abs(pnl));
    }

    // Big floating number for the final PnL
    const canvas = this.renderer.canvas;
    const sign = pnl >= 0 ? '+' : '';
    const color = pnl >= 0 ? '#00ff88' : '#ff3333';
    this.juice.spawnFloatingText(`${sign}${formatCompact(pnl)}`, canvas.width * 0.5, canvas.height * 0.3, color, 20);

    // Feed event for significant trades
    if (Math.abs(pnl) >= 50) this.feed.addProfit(pnl, this.playerName);
  }

  private liquidate(assetId: string): void {
    this.state = 'liquidated';
    const ts = this.tradePool.get(assetId)!;
    const asset = ASSET_MAP[assetId];
    const pos = ts.position!;
    const col = pos.collateral;
    const recovery = col * this.upgrades.insuranceRecovery;
    const exitPrice = this.marketPool.get(assetId)!.price;
    this.tradeHistory.unshift({
      assetId, assetLabel: asset?.label ?? assetId,
      side: pos.side, entryPrice: pos.entryPrice, exitPrice,
      pnl: -(col - recovery), leverage: pos.leverage,
      closedAt: Date.now(), wasLiquidated: true,
    });
    if (this.tradeHistory.length > 100) this.tradeHistory.pop();
    this.player.applyPnL(-(col - recovery));
    ts.reset();

    // Maximum juice + sound
    this.renderer.triggerShake(16, 25);
    this.juice.triggerFlash('#ff0000', 0.5, 20);
    this.sound.liquidation();

    // Dramatic floating text
    const canvas = this.renderer.canvas;
    this.juice.spawnFloatingText(`-${formatCompact(col)}`, canvas.width * 0.5, canvas.height * 0.4, '#ff3333', 24);

    this.ui.showGameOver(this.player);
    this.save.save(this.player, this.bots, this.upgrades, this.prestige, this.tradeHistory, this.gameMinutes);
    this.feed.addLiquidation(this.playerName || 'You');
  }

  private applyDebtPenalty(): void {
    for (const ts of this.tradePool.values()) ts.reset();
    this.player.balance = this.getEffectiveStartingBalance();
    this.prestige.startDebt(1);
    this.updateEffectiveMaxLeverage();
    this.renderer.triggerShake(14, 22);
    this.juice.triggerFlash('#ff4400', 0.55, 25);
    this.sound.liquidation();
    this.ui.showDebtPenalty(this.prestige.getDebtDuration());
    this.save.save(this.player, this.bots, this.upgrades, this.prestige, this.tradeHistory, this.gameMinutes);
  }

  private restartFromLiquidation(): void {
    this.player.balance = this.getEffectiveStartingBalance();
    for (const ts of this.tradePool.values()) ts.reset();
    this.upgrades.reset(); // perks are run-specific
    this.state = 'running';
    this.ui.hideGameOver();
    this.juice.triggerFlash('#3366ff', 0.1, 10);
    this.sound.restart();
  }

  private buyBot(type: BotType): void {
    const discountedCost = Math.floor(this.bots.getCost(type) * this.upgrades.botCostMultiplier);
    if (this.player.balance < discountedCost) return;
    if (!this.prestige.unlockedBotTypes.includes(type)) return;
    if (this.bots.getCount(type) >= 315) return;
    this.player.balance -= discountedCost;
    this.bots.buyBot(type);
    const botBuyReward = this.missions.onBotBought();
    if (botBuyReward > 0) this.giveMissionReward(botBuyReward);
    this.juice.triggerFlash('#3399ff', 0.08, 6);
    this.sound.buyBot();
  }

  private applyPerk(id: UpgradeId): void {
    this.upgrades.applyPerk(id);
    if (id === 'time_buffer') {
      this.prestige.debtFrames += this.prestige.getDebtDuration() * 0.10;
    }
    this.updateEffectiveMaxLeverage();
    const upgReward = this.missions.onUpgradeBought();
    if (upgReward > 0) this.giveMissionReward(upgReward);
    this.juice.triggerFlash('#ffaa00', 0.12, 8);
    this.sound.buyUpgrade();
    // After perk picked, show the prestige unlocks popup
    this._showPrestigePopupAfterPerk();
  }

  private _pendingPrestigeData: { p: number; unlockedBots: string[]; unlockedAssets: string[] } | null = null;

  private _showPrestigePopupAfterPerk(): void {
    if (!this._pendingPrestigeData) return;
    const { p, unlockedBots, unlockedAssets } = this._pendingPrestigeData;
    this._pendingPrestigeData = null;
    this.ui.showPrestigePopup({
      prestigeCount: p,
      title: this.prestige.getPrestigeTitle(),
      profitMultiplier: this.prestige.profitMultiplier,
      unlockedBots,
      unlockedAssets,
    });
  }

  private doPrestige(): void {
    if (!this.prestige.canPrestige(this.player.balance)) return;
    const balanceAtPrestige = this.player.balance;

    this.prestige.prestige(1);

    // Record leaderboard entry: balance before reset, rank after
    if (this.hasChosenName) {
      this.leaderboard.submit(this.playerName, balanceAtPrestige, this.prestige.prestigeCount, this.prestige.getPrestigeTitle());
    }

    this.player.reset(this.getEffectiveStartingBalance());
    this.updateEffectiveMaxLeverage();
    for (const ts of this.tradePool.values()) ts.reset();
    this.missions.init(this.prestige.prestigeCount, this.prestige.getPrestigeThreshold());
    this.market = this.marketPool.get(this.currentAsset.id)!;

    // Big rank-up flash + sound
    this.juice.triggerFlash('#aa77ff', 0.4, 20);
    this.renderer.triggerShake(8, 15);
    this.sound.prestige();

    this.save.save(this.player, this.bots, this.upgrades, this.prestige, this.tradeHistory, this.gameMinutes);

    // Compute unlocks at this rank
    const p = this.prestige.prestigeCount;
    const unlockedBots = ['scalper','grid','trend','sniper','yolo','martingale','quant','hft','arbitrage','omega']
      .filter(t => this.prestige.getBotUnlockRequirement(t).prestigeCount === p);
    const unlockedAssets = ASSETS.filter(a => a.prestigeRequired === p);

    // Store for after perk selection
    this._pendingPrestigeData = { p, unlockedBots, unlockedAssets: unlockedAssets.map(a => a.label) };

    // Roll perk choices — show selection overlay
    const choices = this.upgrades.rollChoices(p);
    if (choices.length === 0) {
      // All perks maxed — skip perk selection
      this._showPrestigePopupAfterPerk();
    } else {
      this.ui.showPerkChoice(choices);
    }
  }

  // --- Helpers ---

  isLiquidationApproaching(): boolean {
    const pos = this.trades.position;
    if (!pos) return false;
    const dist = Math.abs(this.market.price - pos.liquidationPrice);
    const threshold = pos.entryPrice * LIQ_WARNING_THRESHOLD;
    return dist < threshold;
  }

  getBotCost(type: BotType): number {
    return Math.floor(this.bots.getCost(type) * this.upgrades.botCostMultiplier);
  }

  getProfitMultiplier(): number {
    return this.upgrades.profitMultiplier * this.prestige.profitMultiplier;
  }

  getSpeedMultiplier(): number {
    return this.upgrades.speedMultiplier;
  }

  isRunning(): boolean {
    return this.state === 'running';
  }

  get playerName(): string {
    return localStorage.getItem(PLAYER_NAME_KEY) || generateName();
  }

  get hasChosenName(): boolean {
    return localStorage.getItem(PLAYER_NAME_KEY) !== null;
  }

  setPlayerName(name: string): void {
    const trimmed = name.trim().slice(0, 20);
    localStorage.setItem(PLAYER_NAME_KEY, trimmed || generateName());
    this.feed.setPlayerName(this.playerName);
    if (this.tutorialPendingAfterName) {
      this.tutorialPendingAfterName = false;
      setTimeout(() => this.startTutorial(), 300);
    }
  }

  private startTutorial(): void {
    if (TutorialSystem.isDone()) return;
    this.tutorial = new TutorialSystem();
    this.tutorial.start();
  }

  switchAsset(id: string): void {
    const asset = ASSET_MAP[id];
    if (!asset) return;
    // Save current asset's leverage before switching
    this.leveragePool.set(this.currentAsset.id, this.player.leverage);
    this.currentAsset = asset;
    this.bots.cancelAllTrades();
    this.market = this.marketPool.get(asset.id)!;
    this.events = this.eventPool.get(asset.id)!;
    this.news.assetId = asset.id;
    this.updateEffectiveMaxLeverage();
    // Restore this asset's saved leverage (clamped to new cap)
    const saved = this.leveragePool.get(asset.id);
    if (saved !== undefined) {
      this.player.leverage = Math.max(1, Math.min(this.player.maxLeverage, saved));
    }
    this.prevPnl = 0;
    this.pnlAccum = 0;
    this.juice.triggerFlash(asset.color, 0.08, 8);
    this.sound.tabClick();
  }

  updateMarketSpeed(): void {
    const p = this.prestige.prestigeCount;
    const baseSpeed = Math.min(1.8, 0.02 + p * 0.04);
    const sample = Math.max(1, Math.round(8 - p * 0.35));
    for (const [id, m] of this.marketPool) {
      const asset = ASSET_MAP[id];
      m.speedMult = asset ? Math.min(baseSpeed, asset.speedCap) : baseSpeed;
      m.sampleInterval = sample;
    }
  }

  private giveMissionReward(reward: number): void {
    if (reward <= 0) return;
    this.player.balance += reward;
    const canvas = this.renderer.canvas;
    this.juice.spawnFloatingText(`MISSION +${formatCompact(reward)}`, canvas.width * 0.5, canvas.height * 0.55, '#ffdd44', 16);
    this.sound.buyUpgrade();
  }

  getEffectiveStartingBalance(): number {
    return 1000;
  }

  updateEffectiveMaxLeverage(): void {
    const assetCap    = this.currentAsset.leverageCap;
    const prestigeCap = this.prestige.maxLeverage;
    const cap = Math.max(1, Math.floor(Math.min(assetCap, prestigeCap)) + this.upgrades.leverageUpBonus);
    this.player.maxLeverage = cap;
    if (this.player.leverage > cap) this.player.leverage = cap;
  }

  private sizeCanvas(): void {
    const wrapper = this.renderer.canvas.parentElement!;
    this.renderer.resize(wrapper.clientWidth, wrapper.clientHeight);
  }
}

/** Compact money format for floating text */
function formatCompact(n: number): string {
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
