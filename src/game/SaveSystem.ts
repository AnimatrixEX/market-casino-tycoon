// SaveSystem.ts — localStorage save/load with auto-save

import { Player } from './Player';
import { BotManager } from './BotManager';
import { UpgradeSystem, UpgradeId } from './UpgradeSystem';
import { PrestigeSystem } from './PrestigeSystem';
import { BotType } from './Bot';
import { TradeRecord } from './TradeSystem';

const SAVE_KEY = 'mct_save_v1';
const AUTO_SAVE_INTERVAL = 180; // frames (~3 sec at 60fps)
const TRADE_HISTORY_MAX = 100;
const IDLE_CAP_SECONDS = 28_800; // 8 hours
const IDLE_EFFICIENCY   = 0.075; // 7.5% of real-time bot earnings

interface SaveData {
  version: 1;
  timestamp: number;
  player: {
    balance: number;
    leverage: number;
    peakBalance: number;
  };
  bots: {
    types: BotType[];
    totalProfit: number;
  };
  upgrades: Record<UpgradeId, number>;
  prestige: {
    prestigeCount: number;
    debtFrames: number;
    debtInterestMult: number;
  };
  tradeHistory?: TradeRecord[];
  gameMinutes?: number;
}

export class SaveSystem {
  private frameCounter = 0;

  tick(player: Player, bots: BotManager, upgrades: UpgradeSystem, prestige: PrestigeSystem, tradeHistory?: TradeRecord[], gameMinutes?: number): void {
    this.frameCounter++;
    if (this.frameCounter >= AUTO_SAVE_INTERVAL) {
      this.save(player, bots, upgrades, prestige, tradeHistory, gameMinutes);
      this.frameCounter = 0;
    }
  }

  save(player: Player, bots: BotManager, upgrades: UpgradeSystem, prestige: PrestigeSystem, tradeHistory?: TradeRecord[], gameMinutes?: number): void {
    const data: SaveData = {
      version: 1,
      timestamp: Date.now(),
      player: {
        balance: player.balance,
        leverage: player.leverage,
        peakBalance: player.peakBalance,
      },
      bots: bots.serialize(),
      upgrades: upgrades.serialize(),
      prestige: prestige.serialize(),
      tradeHistory: (tradeHistory ?? []).slice(0, TRADE_HISTORY_MAX),
      gameMinutes,
    };

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable — silently fail
    }
  }

  load(
    player: Player,
    bots: BotManager,
    upgrades: UpgradeSystem,
    prestige: PrestigeSystem,
    tradeHistoryOut?: TradeRecord[],
    gameMinutesOut?: { value: number }
  ): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;

      const data: SaveData = JSON.parse(raw);
      if (data.version !== 1) return false;

      // Restore prestige first (affects starting balance)
      prestige.deserialize(data.prestige);

      // Restore player
      player.balance = data.player.balance;
      player.leverage = data.player.leverage;
      player.peakBalance = data.player.peakBalance;
      player.startBalance = 1000;

      // Restore upgrades
      upgrades.deserialize(data.upgrades);

      // Restore bots
      bots.deserialize(data.bots);

      // Restore trade history (capped to avoid bloated saves)
      if (tradeHistoryOut && Array.isArray(data.tradeHistory)) {
        tradeHistoryOut.push(...data.tradeHistory.slice(0, TRADE_HISTORY_MAX));
      }

      if (gameMinutesOut && data.gameMinutes !== undefined) {
        gameMinutesOut.value = data.gameMinutes;
      }

      return true;
    } catch {
      return false;
    }
  }

  /** Compute idle earnings since last save. Returns null if nothing meaningful. */
  getIdleEarnings(
    bots: BotManager,
    upgrades: UpgradeSystem,
    prestige: PrestigeSystem,
  ): { earnings: number; elapsedSeconds: number; botCount: number } | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data: SaveData = JSON.parse(raw);
      const elapsed = (Date.now() - data.timestamp) / 1000; // seconds
      if (elapsed < 30) return null; // skip tiny gaps

      const cappedTime = Math.min(elapsed, IDLE_CAP_SECONDS);
      const profitMult = upgrades.profitMultiplier * prestige.profitMultiplier;
      const speedMult  = upgrades.speedMultiplier;
      const pps        = bots.estimatedTotalPps(profitMult, speedMult);
      const earnings   = pps * cappedTime * IDLE_EFFICIENCY;

      if (earnings < 1) return null;

      const botCount = (data.bots?.types ?? []).length;
      return { earnings, elapsedSeconds: Math.round(cappedTime), botCount };
    } catch {
      return null;
    }
  }

  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }
}
