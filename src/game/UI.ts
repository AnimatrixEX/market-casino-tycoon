// UI.ts — DOM updates with smooth interpolation, button juice, tab panels

import { BotType, BOT_CONFIGS } from './Bot';
import { UpgradeId, UPGRADE_DEFS } from './UpgradeSystem';
import { ASSETS } from './AssetConfig';
import { Player } from './Player';
import { JuiceSystem } from './JuiceSystem';
import type { Game } from './Game';

function $(id: string) { return document.getElementById(id)!; }
function formatMoney(n: number): string {
  if (Math.abs(n) >= 999999e33) return '$\u221E';
  return formatCost(n);
}
function formatCost(n: number): string {
  if (Math.abs(n) >= 1e33) return `$${(n / 1e33).toFixed(2)}De`;
  if (Math.abs(n) >= 1e30) return `$${(n / 1e30).toFixed(2)}No`;
  if (Math.abs(n) >= 1e27) return `$${(n / 1e27).toFixed(2)}Oc`;
  if (Math.abs(n) >= 1e24) return `$${(n / 1e24).toFixed(2)}Sp`;
  if (Math.abs(n) >= 1e21) return `$${(n / 1e21).toFixed(2)}Sx`;
  if (Math.abs(n) >= 1e18) return `$${(n / 1e18).toFixed(2)}Qi`;
  if (Math.abs(n) >= 1e15) return `$${(n / 1e15).toFixed(2)}Qa`;
  if (Math.abs(n) >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export class UI {
  // Header
  private priceDisplay   = $('price-display');
  private eventBanner    = $('event-banner');
  private headerBalance  = $('header-balance');
  private prestigeRank    = $('prestige-rank');
  private prestigeThresh  = $('prestige-threshold');
  private prestigeBarFill = $('prestige-bar-fill') as HTMLElement;

  // Sidebar
  private statPnl        = $('stat-pnl');
  private positionType   = $('position-type');
  private positionBlock  = $('position-block');
  private positionEntry  = $('position-entry');
  private positionLiq    = $('position-liq');
  private leverageDisplay = $('leverage-display');
  private sizeDisplay    = $('size-display');
  private sizeAmount     = $('size-amount');
  private sizeSlider     = $('size-slider') as HTMLInputElement;
  private botPps         = $('bot-pps');
  private botCount       = $('bot-count');
  private botIncomeBlock = $('bot-income-block');
  private footerVol      = $('footer-vol');

  // Buttons
  private btnLong     = $('btn-long')      as HTMLButtonElement;
  private btnShort    = $('btn-short')     as HTMLButtonElement;
  private levSlider   = $('leverage-slider') as HTMLInputElement;
  private btnRestart  = $('btn-restart')   as HTMLButtonElement;
  private btnPrestige = $('btn-prestige')  as HTMLButtonElement;
  private rankTabBtn  = document.querySelector('[data-tab="prestige"]') as HTMLElement | null;

  // Overlays
  private overlay        = $('overlay');
  private overlayFinal   = $('overlay-final');
  private prestigePopup  = $('prestige-popup');
  private idlePopup      = $('idle-popup');

  // Panels
  private botGrid     = $('bot-grid');
  private upgradeGrid = $('upgrade-grid');
  private prestigeInfo    = $('prestige-info');
  private prestigeBonuses = $('prestige-bonuses');

  // Flash news banner
  private flashBanner = $('flash-news-banner');
  private lastFlashText = '';

  // News ticker
  private tickerContainer = $('news-ticker');
  private tickerTrack     = $('ticker-track');
  private lastNewsCount   = 0;
  private tickerOffset    = 0;
  private tickerWidth     = 0;   // track scrollWidth
  private tickerSpeed     = 0.8; // px per frame

  // Throttle panel rebuilds
  private panelFrame = 0;
  private uiFrame = 0;  // throttle general DOM updates
  private lastBotHtml = '';
  private lastUpgradeHtml = '';
  private lastMarketHtml = '';
  private lastLeaderboardHtml = '';
  private lastTradeHistoryHtml = '';
  private openPosAssetIds = '';   // tracks which assets are open (for structural rebuild)
  private onSelectAsset: ((id: string) => void) | null = null;

  // Track previous values for change detection
  private prevBalanceFloor = 0;
  private balFlashTimer = 0;

  constructor() {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const tabId = (btn as HTMLElement).dataset.tab;
        $(`panel-${tabId}`).classList.add('active');
      });
    });

    // Overlay dismiss
    $('btn-prestige-ok').addEventListener('click', () => this.prestigePopup.classList.remove('visible'));
    $('btn-idle-ok').addEventListener('click', () => this.idlePopup.classList.remove('visible'));
  }

  bindActions(handlers: {
    onLong: () => void;
    onShort: () => void;
    onLevChange: (value: number) => void;
    onRestart: () => void;
    onBuyBot: (type: BotType) => void;
    onSelectPerk: (id: UpgradeId) => void;
    onPrestige: () => void;
    onToggleMute: () => boolean;
    onTabClick: () => void;
    onSelectAsset: (id: string) => void;
    onNextAsset: () => void;
    onSizeChange: (pct: number) => void;
    onClearLeaderboard: () => void;
    onSetName: (name: string) => void;
    onRefreshLeaderboard: () => Promise<void>;
  }): void {
    // Button click with visual flash feedback
    const wire = (btn: HTMLButtonElement, fn: () => void) => {
      btn.addEventListener('click', () => {
        fn();
        btn.classList.add('clicked');
        setTimeout(() => btn.classList.remove('clicked'), 150);
      });
    };

    wire(this.btnLong, handlers.onLong);
    wire(this.btnShort, handlers.onShort);
    // Leverage slider
    this.levSlider.addEventListener('input', () => {
      handlers.onLevChange(parseInt(this.levSlider.value, 10));
    });
    // Size slider
    this.sizeSlider.addEventListener('input', () => {
      handlers.onSizeChange(parseInt(this.sizeSlider.value, 10));
    });
    this.btnRestart.addEventListener('click', handlers.onRestart);
    this.btnPrestige.addEventListener('click', handlers.onPrestige);

    // Refresh leaderboard when Scores tab is opened
    const scoresTabBtn = document.querySelector('[data-tab="scores"]');
    if (scoresTabBtn) {
      scoresTabBtn.addEventListener('click', () => {
        handlers.onRefreshLeaderboard().then(() => {
          this.lastLeaderboardHtml = ''; // force re-render
        });
      });
    }

    // Delegated panel buttons (pointerdown for instant response)
    this.botGrid.addEventListener('pointerdown', (e) => {
      const btn = (e.target as HTMLElement).closest('.bot-buy-btn') as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      e.preventDefault();
      handlers.onBuyBot(btn.dataset.bot as BotType);
    });

    // Perk choice overlay delegation
    document.getElementById('perk-choice-cards')?.addEventListener('pointerdown', (e) => {
      const card = (e.target as HTMLElement).closest('.perk-choice-card') as HTMLElement | null;
      if (!card || card.classList.contains('maxed')) return;
      e.preventDefault();
      const overlay = document.getElementById('perk-choice-overlay');
      if (overlay) overlay.classList.remove('visible');
      handlers.onSelectPerk(card.dataset.perk as UpgradeId);
    });

    this.onSelectAsset = handlers.onSelectAsset;

    // Delegated click on a stable ancestor — survives innerHTML rebuilds
    document.getElementById('tab-content')?.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest('.op-row[data-asset]') as HTMLElement | null;
      if (row?.dataset.asset) this.onSelectAsset?.(row.dataset.asset);
    });

    // --- Keyboard shortcuts ---
    const flashBtn = (btn: HTMLButtonElement) => {
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 150);
    };

    const tabBtns = document.querySelectorAll('.tab-btn');
    const switchTab = (index: number) => {
      const btn = tabBtns[index] as HTMLElement | undefined;
      if (btn) btn.click();
    };
    // Tab click sound
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => handlers.onTabClick());
    });

    window.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      // Ignore all shortcuts while perk selection overlay is open
      if (document.getElementById('perk-choice-overlay')?.classList.contains('visible')) {
        e.preventDefault();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'l':
        case 'arrowup':
          e.preventDefault();
          if (!this.btnLong.disabled) { handlers.onLong(); flashBtn(this.btnLong); }
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          if (!this.btnShort.disabled) { handlers.onShort(); flashBtn(this.btnShort); }
          break;
        case 'escape':
          if (this.overlay.classList.contains('visible')) handlers.onRestart();
          break;
        case 'w':
          e.preventDefault();
          if (!this.levSlider.disabled) {
            this.levSlider.value = String(Math.min(parseInt(this.levSlider.max), parseInt(this.levSlider.value) + 1));
            handlers.onLevChange(parseInt(this.levSlider.value, 10));
          }
          break;
        case 'd':
          e.preventDefault();
          if (!this.levSlider.disabled) {
            this.levSlider.value = String(Math.max(1, parseInt(this.levSlider.value) - 1));
            handlers.onLevChange(parseInt(this.levSlider.value, 10));
          }
          break;
        case '1':
          switchTab(0);
          break;
        case '2':
          switchTab(1);
          break;
        case '3':
          switchTab(2);
          break;
        case '4':
          switchTab(3);
          break;
        case '5':
          switchTab(4);
          break;
        case 'p':
          handlers.onPrestige();
          break;
        case 'r':
          if (this.overlay.classList.contains('visible')) handlers.onRestart();
          break;
        case ' ':
          e.preventDefault();
          if (this.overlay.classList.contains('visible')) handlers.onRestart();
          break;
        case 'tab': {
          e.preventDefault();
          handlers.onNextAsset();
          break;
        }
        case 'm': {
          const muted = handlers.onToggleMute();
          const muteBtn = document.getElementById('btn-mute');
          if (muteBtn) muteBtn.textContent = muted ? 'UNMUTE [M]' : 'MUTE [M]';
          break;
        }
      }
    });

    // Asset panel delegation
    const assetPanel = document.getElementById('asset-panel');
    if (assetPanel) {
      assetPanel.addEventListener('pointerdown', (e) => {
        const btn = (e.target as HTMLElement).closest('.asset-btn') as HTMLButtonElement | null;
        if (!btn || btn.disabled) return;
        e.preventDefault();
        handlers.onSelectAsset(btn.dataset.asset!);
      });
    }

    // Mute button in footer
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const muted = handlers.onToggleMute();
        muteBtn.textContent = muted ? 'UNMUTE [M]' : 'MUTE [M]';
      });
    }

    // Change name button (footer)
    const changeNameBtn = document.getElementById('btn-change-name');
    if (changeNameBtn) {
      changeNameBtn.addEventListener('click', () => {
        const stored = localStorage.getItem('mct_player_name') ?? '';
        this.showNameModal(stored, handlers.onSetName);
      });
    }

    // Refresh leaderboard button
    const refreshLbBtn = document.getElementById('btn-refresh-lb');
    if (refreshLbBtn) {
      refreshLbBtn.addEventListener('click', () => {
        handlers.onRefreshLeaderboard().then(() => {
          this.lastLeaderboardHtml = '';
        });
      });
    }

    // Clear leaderboard button
    const clearLbBtn = document.getElementById('btn-clear-lb');
    if (clearLbBtn) {
      clearLbBtn.addEventListener('click', () => {
        handlers.onClearLeaderboard();
        this.lastLeaderboardHtml = '';
      });
    }

    // Reset save button
    const resetBtn = document.getElementById('btn-reset-save');
    if (resetBtn) {
      let confirmPending = false;
      resetBtn.addEventListener('click', () => {
        if (!confirmPending) {
          confirmPending = true;
          resetBtn.textContent = 'CONFIRM?';
          (resetBtn as HTMLButtonElement).style.color = '#cc3333';
          setTimeout(() => {
            confirmPending = false;
            resetBtn.textContent = 'RESET SAVE';
            (resetBtn as HTMLButtonElement).style.color = '';
          }, 2500);
        } else {
          const name = localStorage.getItem('mct_player_name');
          if (name) {
            fetch('/api/leaderboard', {
              method: 'DELETE',
              headers: { 'x-player-name': name },
            }).finally(() => {
              localStorage.removeItem('mct_save_v1');
              localStorage.removeItem('mct_player_name');
              location.reload();
            });
          } else {
            localStorage.removeItem('mct_save_v1');
            location.reload();
          }
        }
      });
    }
  }

  update(game: Game, juice: JuiceSystem): void {
    // --- News ticker runs every frame for smooth scroll ---
    const newsItems = game.news.items;
    if (newsItems.length !== this.lastNewsCount) {
      this.lastNewsCount = newsItems.length;
      this.tickerTrack.innerHTML = newsItems.map(n =>
        `<span class="ticker-item ${n.sentiment}">${n.text}</span><span class="ticker-sep">|</span>`
      ).join('');
      this.tickerWidth = this.tickerTrack.scrollWidth;
    }
    const containerW = this.tickerContainer.clientWidth;
    this.tickerOffset -= this.tickerSpeed;
    if (this.tickerWidth > 0 && this.tickerOffset < -this.tickerWidth) {
      this.tickerOffset = containerW;
    }
    this.tickerTrack.style.transform = `translateX(${this.tickerOffset}px)`;

    // --- Flash news banner ---
    const flash = game.news.activeFlash;
    if (flash) {
      if (flash.text !== this.lastFlashText) {
        this.lastFlashText = flash.text;
        this.flashBanner.textContent = flash.text;
        this.flashBanner.className = flash.sentiment;
      }
      this.flashBanner.classList.add('visible');
    } else {
      this.flashBanner.classList.remove('visible');
      this.lastFlashText = '';
    }

    // --- Balance flash timer (frame-based, always tick) ---
    if (this.balFlashTimer > 0) {
      this.balFlashTimer--;
      if (this.balFlashTimer <= 0) {
        this.headerBalance.className = '';
      }
    }

    // --- Throttle all other DOM updates to every 3 frames ---
    this.uiFrame++;
    if (this.uiFrame < 3) return;
    this.uiFrame = 0;

    const { market, player, trades, events, bots, prestige } = game;
    const approaching = game.isLiquidationApproaching();

    // --- Asset symbol + market status badge ---
    const symEl = document.getElementById('asset-symbol');
    if (symEl) symEl.textContent = game.currentAsset.symbol;

    // --- Price display with direction color ---
    this.priceDisplay.textContent = juice.displayPrice.toFixed(2);
    const dir = juice.priceVelocity;
    if (dir > 0.05) {
      this.priceDisplay.className = 'up';
    } else if (dir < -0.05) {
      this.priceDisplay.className = 'down';
    } else {
      this.priceDisplay.className = '';
    }

    // --- Event banner ---
    this.eventBanner.textContent = events.getLabel();

    // --- Balance with smooth interpolation ---
    this.headerBalance.textContent = formatMoney(juice.displayBalance);
    const balFloor = Math.floor(juice.displayBalance / 100); // coarser granularity to reduce flashes
    if (balFloor !== this.prevBalanceFloor) {
      if (this.balFlashTimer <= 0) {
        if (balFloor > this.prevBalanceFloor) {
          this.headerBalance.className = 'flash-green';
        } else {
          this.headerBalance.className = 'flash-red';
        }
        this.balFlashTimer = 18;
      }
      this.prevBalanceFloor = balFloor;
    }

    // --- Debt header ---
    const threshold = prestige.getEffectiveThreshold();
    const pct = Math.min(100, (player.balance / threshold) * 100);
    this.prestigeRank.textContent = `R${prestige.prestigeCount} · ${prestige.getPrestigeTitle()}`;
    const interestPct = ((prestige.debtInterestMult - 1) * 100).toFixed(1);
    const interestTag = prestige.debtInterestMult > 1.001
      ? ` <span style="color:#ff6644;font-size:10px;">+${interestPct}%</span>`
      : '';
    this.prestigeThresh.innerHTML =
      `<span class="hdr-debt-lbl">DEBT</span>` +
      `<span class="hdr-debt-val">${formatMoney(threshold)}</span>${interestTag}`;
    this.prestigeBarFill.style.width = `${pct.toFixed(1)}%`;
    this.prestigeBarFill.style.background = '';

    // --- PnL ---
    if (trades.position) {
      const pnl = juice.displayPnl;
      const sign = pnl >= 0 ? '+' : '';
      this.statPnl.textContent = `${sign}${formatMoney(pnl)}`;
      this.statPnl.className = 'stat-value ' + (
        approaching ? 'warning' : (pnl >= 0 ? 'positive' : 'negative')
      );
    } else {
      this.statPnl.textContent = '--';
      this.statPnl.className = 'stat-value';
    }

    // --- Position block ---
    if (trades.position) {
      const pos = trades.position;
      this.positionType.textContent = 'BUY';
      this.positionType.className = pos.side;
      this.positionBlock.className = 'active-long';
      this.positionEntry.textContent = `Entry: ${pos.entryPrice.toFixed(2)}`;
      this.positionLiq.textContent = `Liq: ${pos.liquidationPrice.toFixed(2)}`;
    } else {
      this.positionType.textContent = 'NONE';
      this.positionType.className = '';
      this.positionBlock.className = '';
      this.positionEntry.textContent = '--';
      this.positionLiq.textContent = '--';
    }

    // --- Leverage ---
    this.leverageDisplay.textContent = `x${player.leverage}`;

    // --- Trade buttons ---
    const inTrade = !!trades.position;
    this.btnLong.disabled  = inTrade;
    this.btnShort.disabled = !inTrade;
    this.levSlider.disabled = inTrade;
    this.levSlider.max = String(player.maxLeverage);
    if (parseInt(this.levSlider.value, 10) !== player.leverage) this.levSlider.value = String(player.leverage);
    this.sizeSlider.disabled = inTrade;
    const sizePct = Math.round(player.tradeSize * 100);
    if (parseInt(this.sizeSlider.value, 10) !== sizePct) this.sizeSlider.value = String(sizePct);
    this.sizeDisplay.textContent = `${sizePct}%`;
    this.sizeAmount.textContent = formatCost(player.balance * player.tradeSize);

    // --- Bot summary ---
    const profitMult = game.getProfitMultiplier();
    const speedMult = game.getSpeedMultiplier();
    const estPps = bots.estimatedTotalPps(profitMult, speedMult);
    this.botPps.textContent = `${formatMoney(estPps)}/s`;
    this.botCount.textContent = String(bots.bots.length);

    // Bot pulse visual
    if (juice.botPulse > 0.1) {
      this.botIncomeBlock.classList.add('pulse');
      this.botPps.classList.add('flash');
    } else {
      this.botIncomeBlock.classList.remove('pulse');
      this.botPps.classList.remove('flash');
    }

    // --- Footer ---
    this.footerVol.textContent = `VOL: ${market.volatilityPct.toFixed(4)}%`;

    // --- Panels (throttled further) ---
    this.panelFrame++;
    if (this.panelFrame >= 4) {
      this.panelFrame = 0;
      this.updateBotPanel(game);
      this.updateUpgradePanel(game);
      this.updatePrestigePanel(game);
      this.updateMarketPanel(game);
      this.updateLeaderboardPanel(game);
      this.updateTradesPanel(game);
      this.updateMissionsPanel(game);
    }
  }

  // ---- BOT PANEL ----
  private updateBotPanel(game: Game): void {
    const { player, bots, prestige } = game;
    const types: BotType[] = ['basic', 'scalper', 'grid', 'trend', 'sniper', 'yolo', 'martingale', 'quant', 'hft', 'arbitrage', 'omega'];
    const unlocked = prestige.unlockedBotTypes;

    let html = '';
    for (const type of types) {
      const cfg = BOT_CONFIGS[type];
      const count = bots.getCount(type);
      const cost = game.getBotCost(type);
      const isUnlocked = unlocked.includes(type);
      const canAfford = player.balance >= cost;
      const atCap = count >= 315;

      html += `<div class="bot-card${isUnlocked ? '' : ' locked'}">`;
      html += `<div class="bot-name">${cfg.label}</div>`;
      html += `<div class="bot-stats">`;
      html += `Owned: <span>${count}</span><br>`;
      html += `Leverage: <span>x${cfg.leverage}</span><br>`;
      html += `Risk: <span>${(cfg.baseLiqRisk * 100).toFixed(0)}%</span><br>`;

      if (isUnlocked) {
        const profitMult = game.getProfitMultiplier();
        const speedMult = game.getSpeedMultiplier();
        const dummyPps = cfg.baseCost * cfg.baseProfitRate * profitMult * 0.7;
        const cycle = (cfg.tradeInterval * speedMult + cfg.holdDuration);
        const singlePps = dummyPps * (60 / cycle);
        html += `Income: <span style="color:#00a066">${formatMoney(singlePps)}/s</span>`;
      } else {
        const req = prestige.getBotUnlockRequirement(type);
        html += `<span style="color:#662200;font-size:10px;">Rank ${req.prestigeCount} required</span>`;
      }

      html += `</div>`;
      html += `<button class="bot-buy-btn" data-bot="${type}" ${(!isUnlocked || !canAfford || atCap) ? 'disabled' : ''}>`;
      html += !isUnlocked ? 'LOCKED' : atCap ? 'MAX (315)' : `BUY ${formatCost(cost)}`;
      html += `</button></div>`;
    }

    if (html !== this.lastBotHtml) {
      this.lastBotHtml = html;
      this.botGrid.innerHTML = html;
    }
  }

  // ---- PERKS PANEL ----
  private updateUpgradePanel(game: Game): void {
    const { upgrades, prestige } = game;
    const allIds: UpgradeId[] = [
      'profit_boost', 'liq_shield', 'speed_boost', 'bot_efficiency',
      'news_insight', 'insurance', 'multi_trade',
      'cascade_income', 'leverage_mastery', 'algo_trading', 'vol_harvest', 'compound_engine',
    ];
    const catColor: Record<string, string> = {
      income: '#00d084', bots: '#4499ff', risk: '#ff9900', market: '#cc77ff',
    };

    const active = allIds.filter(id => upgrades.getLevel(id) > 0);
    const locked  = allIds.filter(id => upgrades.getLevel(id) === 0);

    let html = '';

    if (active.length === 0) {
      html += `<div style="color:#445566;font-size:12px;text-align:center;padding:20px;">Rank up to earn your first perk.</div>`;
    } else {
      html += `<div class="perk-panel-section-label">Active perks</div><div class="perk-active-grid">`;
      for (const id of active) {
        const def = UPGRADE_DEFS[id];
        const level = upgrades.getLevel(id);
        const maxed = upgrades.isMaxed(id);
        const color = catColor[def.category];
        const pct = Math.round((level / def.maxStack) * 100);
        const isNeg = ['liq_shield','speed_boost','bot_efficiency','multi_trade'].includes(id);
        const sign = isNeg ? '-' : '+';
        const curPct = Math.round(level * def.valuePerLevel * 100);
        html += `<div class="perk-active-card" style="border-color:${color}22;">`;
        html += `<div class="perk-active-icon">${def.icon}</div>`;
        html += `<div class="perk-active-body">`;
        html += `<div class="perk-active-name" style="color:${color};">${def.label}</div>`;
        html += `<div class="perk-active-val">${sign}${curPct}%${maxed ? ' <span style="color:#666;font-size:9px;">MAX</span>' : ''}</div>`;
        html += `<div class="perk-active-bar"><div style="width:${pct}%;background:${color};height:100%;border-radius:2px;"></div></div>`;
        html += `<div class="perk-active-stack">${level}/${def.maxStack}</div>`;
        html += `</div></div>`;
      }
      html += `</div>`;
    }

    // Locked / upcoming perks
    const upcoming = locked.filter(id => (UPGRADE_DEFS[id].prestigeRequired ?? 0) > prestige.prestigeCount);
    if (upcoming.length > 0) {
      html += `<div class="perk-panel-section-label" style="margin-top:12px;">Upcoming (higher rank)</div><div class="perk-upcoming-list">`;
      for (const id of upcoming) {
        const def = UPGRADE_DEFS[id];
        html += `<span class="perk-upcoming-tag">${def.icon} ${def.label} <span style="color:#334;">(R${def.prestigeRequired})</span></span>`;
      }
      html += `</div>`;
    }

    if (html !== this.lastUpgradeHtml) {
      this.lastUpgradeHtml = html;
      this.upgradeGrid.innerHTML = html;
    }
  }

  /** Show the perk selection overlay with N choices. */
  showPerkChoice(choices: UpgradeId[]): void {
    const overlay = document.getElementById('perk-choice-overlay');
    const cardsEl = document.getElementById('perk-choice-cards');
    if (!overlay || !cardsEl) return;

    const catColor: Record<string, string> = {
      income: '#00d084', bots: '#4499ff', risk: '#ff9900', market: '#cc77ff',
    };

    cardsEl.innerHTML = choices.map(id => {
      const def = UPGRADE_DEFS[id];
      const color = catColor[def.category];
      return `<div class="perk-choice-card" data-perk="${id}" style="border-color:${color};">
        <div class="perk-choice-icon">${def.icon}</div>
        <div class="perk-choice-name" style="color:${color};">${def.label}</div>
        <div class="perk-choice-desc">${def.description}</div>
      </div>`;
    }).join('');

    overlay.classList.add('visible');
  }

  // ---- RANK / DEBT PANEL ----
  private updatePrestigePanel(game: Game): void {
    const { player, prestige } = game;
    const threshold  = prestige.getEffectiveThreshold();
    const baseThresh = prestige.getPrestigeThreshold();
    const canP       = prestige.canPrestige(player.balance);
    const progressPct = Math.min(100, (player.balance / threshold) * 100);
    const barColor   = canP ? '#aa77ff' : '#443366';
    const interestPct = ((prestige.debtInterestMult - 1) * 100).toFixed(1);
    const interestLine = prestige.debtInterestMult > 1.001
      ? `<div style="font-size:10px;color:#ff6644;margin-top:3px;">⚠ Interest +${interestPct}% · Base ${formatMoney(baseThresh)}</div>`
      : '';

    this.prestigeInfo.innerHTML =
      `<div class="rank-top-row">` +
        `<div class="rank-badge">` +
          `<div class="rank-num">R${prestige.prestigeCount}</div>` +
          `<div class="rank-title-text">${prestige.getPrestigeTitle()}</div>` +
          (!prestige.isMaxTitle() ? `<div class="rank-next-title">→ ${prestige.getNextTitle()}</div>` : '') +
        `</div>` +
        `<div class="debt-card">` +
          `<div class="debt-card-label">Debt Repayment</div>` +
          `<div class="debt-amounts">` +
            `<span class="debt-balance-val">${formatMoney(player.balance)}</span>` +
            `<span class="debt-threshold-val">/ ${formatMoney(threshold)}</span>` +
          `</div>` +
          `<div class="debt-bar-track"><div class="debt-bar-fill" style="width:${progressPct}%;background:${barColor};"></div></div>` +
          `<div class="debt-status">` +
            `<span class="debt-pct">${progressPct.toFixed(1)}%</span>` +
            (canP
              ? `<span class="debt-ready">✓ Ready to repay</span>`
              : `<span class="debt-missing">Missing ${formatMoney(threshold - player.balance)}</span>`) +
          `</div>` +
          interestLine +
          `<div class="rank-timer-hint" style="margin-top:6px;font-size:11px;color:#6677aa;">Repaying resets balance to zero — bots &amp; upgrades are kept</div>` +
        `</div>` +
      `</div>`;

    this.prestigeBonuses.innerHTML =
      `<div class="rank-bonuses-label">Rank Bonuses</div>` +
      `<div class="rank-bonus-cards">` +
        `<div class="rank-bonus-card">` +
          `<div class="rank-bonus-val">×${prestige.profitMultiplier.toFixed(2)}</div>` +
          `<div class="rank-bonus-name">Profit Mult</div>` +
        `</div>` +
        `<div class="rank-bonus-card">` +
          `<div class="rank-bonus-val">${(prestige.riskReduction * 100).toFixed(0)}%</div>` +
          `<div class="rank-bonus-name">Risk Reduction</div>` +
        `</div>` +
      `</div>`;

    this.btnPrestige.disabled = !canP;
    this.btnPrestige.textContent = canP ? 'REPAY DEBT' : 'RANK UP';
    this.btnPrestige.classList.toggle('rank-ready-btn', canP);
    this.rankTabBtn?.classList.toggle('rank-ready', canP);
  }

  private lastMissionsHtml = '';
  private lastMissionIdx = -1;
  private updateMissionsPanel(game: Game): void {
    const el = document.getElementById('missions-panel');
    if (!el) return;
    const { missions } = game;
    const allDone = missions.allDone;

    const SHOW_DONE_MS = 10_000;
    const now = Date.now();
    const visible = missions.missions.filter(
      m => !m.done || (m.completedAt !== undefined && now - m.completedAt < SHOW_DONE_MS)
    );

    if (allDone && visible.length === 0) {
      if (el.style.display !== 'none') {
        el.style.display = 'none';
        this.lastMissionsHtml = '';
      }
      return;
    }
    el.style.display = '';

    const pending = visible.filter(m => !m.done);
    const done = missions.completedCount;
    const total = missions.missions.length;

    const idx = Math.floor(Date.now() / 5000) % missions.missions.length;
    // Force re-render with animation when index changes
    if (idx !== this.lastMissionIdx) {
      this.lastMissionsHtml = '';
      this.lastMissionIdx = idx;
    }
    const m = missions.missions[idx];
    const pct = m.done ? 100 : Math.min(100, (m.progress / m.target) * 100);
    const color = m.done ? '#00d084' : '#aa77ff';

    let html = `<div class="mission-row mission-anim">`;
    html += `<span class="missions-title">Daily</span>`;
    html += `<span class="missions-count">${done}/${total}</span>`;
    html += `<span class="mission-label" style="color:${m.done ? '#00d084' : '#9988bb'};">${m.label}</span>`;
    html += `<div class="mission-seg"><div class="mission-seg-fill" style="width:${pct.toFixed(1)}%;background:${color};"></div></div>`;
    html += `<span class="mission-reward" style="color:${m.done ? '#00d084' : '#ffdd44'};">${m.done ? 'done' : '+' + formatMoney(m.reward)}</span>`;
    html += `</div>`;

    if (html !== this.lastMissionsHtml) {
      this.lastMissionsHtml = html;
      el.innerHTML = html;
    }
  }

  // ---- MARKET PANEL (left asset selector) ----
  private updateMarketPanel(game: Game): void {
    const { prestige } = game;
    const current = game.currentAsset;

    let html = '';
    for (const asset of ASSETS) {
      const isUnlocked = prestige.prestigeCount >= asset.prestigeRequired;
      const isActive = asset.id === current.id;
      const disabled = !isUnlocked || isActive;
      const assetTs = game.tradePool.get(asset.id);
      const hasPosition = !!assetTs?.position;

      let cls = 'asset-btn';
      if (isActive) cls += ' ab-active';
      if (!isUnlocked) cls += ' ab-locked';
      if (hasPosition && !isActive) cls += ' ab-has-pos';

      let subtitle = '';
      if (!isUnlocked) {
        subtitle = `<span class="ab-lock">P${asset.prestigeRequired}</span>`;
      } else if (hasPosition) {
        const side = assetTs!.position!.side;
        subtitle = `<span class="ab-mult ${side === 'long' ? 'ab-pos-long' : 'ab-pos-short'}">${side === 'long' ? '▲' : '▼'}</span>`;
      } else if (isActive) {
        subtitle = `<span class="ab-mult" style="color:#3366cc">ON</span>`;
      } else {
        subtitle = `<span class="ab-mult">x${asset.profitMult.toFixed(1)}</span>`;
      }

      const title = `${asset.label} | Lev x${asset.leverageCap} | Reward x${asset.profitMult} | ${asset.description}`;
      html += `<button class="${cls}" data-asset="${asset.id}" ${disabled ? 'disabled' : ''} title="${title}">`;
      html += `<span class="ab-dot" style="background:${asset.color}"></span>`;
      html += `<span class="ab-sym">${asset.symbol}</span>`;
      html += subtitle;
      html += `</button>`;
    }

    const panel = document.getElementById('asset-panel');
    if (panel && html !== this.lastMarketHtml) {
      this.lastMarketHtml = html;
      // Preserve the label at top
      const label = panel.querySelector('.asset-panel-label');
      panel.innerHTML = '';
      if (label) panel.appendChild(label);
      panel.insertAdjacentHTML('beforeend', html);
    }
  }

  // ---- LEADERBOARD PANEL ----
  private updateLeaderboardPanel(game: Game): void {
    const entries = game.leaderboard.getEntries();
    const tbody = document.getElementById('lb-body');
    const empty = document.getElementById('lb-empty');
    if (!tbody || !empty) return;

    if (entries.length === 0) {
      if (this.lastLeaderboardHtml !== '') {
        this.lastLeaderboardHtml = '';
        tbody.innerHTML = '';
        empty.style.display = 'block';
      }
      return;
    }
    empty.style.display = 'none';

    const medals = ['#1', '#2', '#3'];
    const html = entries.map((e, i) => {
      const rank = medals[i] ?? `#${i + 1}`;
      const date = new Date(e.date).toLocaleDateString();
      return `<tr class="lb-row lb-row-${i}">` +
        `<td class="lb-rank">${rank}</td>` +
        `<td class="lb-name">${e.name ?? '—'}</td>` +
        `<td class="lb-title-cell">${e.title}</td>` +
        `<td>P${e.prestige}</td>` +
        `<td class="lb-balance">${formatMoney(e.balance)}</td>` +
        `<td class="lb-date">${date}</td>` +
        `</tr>`;
    }).join('');

    if (html !== this.lastLeaderboardHtml) {
      this.lastLeaderboardHtml = html;
      tbody.innerHTML = html;
    }
  }

  // ---- TRADES PANEL ----

  private updateTradesPanel(game: Game): void {
    // --- Open positions ---
    const posEl = document.getElementById('open-positions');
    if (posEl) {
      // Compute which assets have open positions (for structural change detection)
      const openIds = ASSETS.filter(a => game.tradePool.get(a.id)?.position).map(a => a.id).join(',');

      if (openIds !== this.openPosAssetIds) {
        // Structure changed — full rebuild and re-attach onclick handlers
        this.openPosAssetIds = openIds;
        if (!openIds) {
          posEl.innerHTML = '<div class="trades-empty">No open positions</div>';
        } else {
          let html = '';
          for (const asset of ASSETS) {
            const ts = game.tradePool.get(asset.id);
            if (!ts?.position) continue;
            const isCurrent = asset.id === game.currentAsset.id;
            const sideCls = ts.position.side === 'long' ? 'op-long' : 'op-short';
            html += `<div class="op-row${isCurrent ? ' op-current' : ''}" data-asset="${asset.id}">` +
              `<span class="op-asset">${asset.symbol}</span>` +
              `<span class="op-side op-long">▲ BUY</span>` +
              `<span class="op-lev">x${ts.position.leverage}</span>` +
              `<span class="op-entry">@${ts.position.entryPrice.toFixed(2)}</span>` +
              `<span class="op-pnl" data-pnl="${asset.id}"></span>` +
              `</div>`;
          }
          posEl.innerHTML = html;
          // Attach onclick once after rebuild — stable until next structural change
          posEl.querySelectorAll<HTMLElement>('.op-row[data-asset]').forEach(row => {
            row.onclick = () => this.onSelectAsset?.(row.dataset.asset!);
          });
        }
      }

      // Live PnL update — direct DOM, no rebuild
      for (const asset of ASSETS) {
        const ts = game.tradePool.get(asset.id);
        if (!ts?.position) continue;
        const pnlEl = posEl.querySelector<HTMLElement>(`[data-pnl="${asset.id}"]`);
        if (!pnlEl) continue;
        const pnl = ts.calculatePnL(game.marketPool.get(asset.id)!.price);
        const sign = pnl >= 0 ? '+' : '';
        pnlEl.textContent = `${sign}${formatMoney(pnl)}`;
        pnlEl.className = `op-pnl ${pnl >= 0 ? 'op-profit' : 'op-loss'}`;
      }

      // Update current-asset highlight without rebuild
      posEl.querySelectorAll<HTMLElement>('.op-row[data-asset]').forEach(row => {
        row.classList.toggle('op-current', row.dataset.asset === game.currentAsset.id);
      });
    }

    // --- Trade history ---
    const histEl = document.getElementById('trade-history');
    if (!histEl) return;
    const histHtml = game.tradeHistory.length === 0
      ? '<div class="trades-empty">No trades yet</div>'
      : game.tradeHistory.map(r => {
          const sign = r.pnl >= 0 ? '+' : '';
          const pnlCls = r.pnl >= 0 ? 'hist-profit' : 'hist-loss';
          const sideCls = r.side === 'long' ? 'hist-long' : 'hist-short';
          const liqBadge = r.wasLiquidated ? '<span class="hist-liq">LIQ</span> ' : '';
          const time = new Date(r.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `<div class="hist-row">` +
            `<span class="hist-asset">${r.assetLabel}</span>` +
            `<span class="hist-side ${sideCls}">${r.side.toUpperCase()}</span>` +
            `${liqBadge}` +
            `<span class="hist-lev">x${r.leverage}</span>` +
            `<span class="hist-pnl ${pnlCls}">${sign}${formatMoney(r.pnl)}</span>` +
            `<span class="hist-time">${time}</span>` +
            `</div>`;
        }).join('');
    if (histHtml !== this.lastTradeHistoryHtml) {
      this.lastTradeHistoryHtml = histHtml;
      histEl.innerHTML = histHtml;
    }
  }

  // ---- OVERLAYS ----

  showDebtPenalty(newDurationMs: number): void {
    const popup = document.getElementById('debt-penalty-popup')!;
    const mm = String(Math.floor(newDurationMs / 60000)).padStart(2, '0');
    const ss = String(Math.floor((newDurationMs % 60000) / 1000)).padStart(2, '0');
    const timerEl = document.getElementById('debt-penalty-timer');
    if (timerEl) timerEl.textContent = `${mm}:${ss}`;
    popup.classList.add('visible');
    setTimeout(() => popup.classList.remove('visible'), 3500);
  }

  showGameOver(player: Player): void {
    this.overlayFinal.textContent = `Balance: ${formatMoney(player.balance)}`;
    this.overlay.classList.add('visible');
  }

  hideGameOver(): void {
    this.overlay.classList.remove('visible');
  }

  showPrestigePopup(data: {
    prestigeCount: number; title: string;
    profitMultiplier: number;
    unlockedBots: string[]; unlockedAssets: string[];
  }): void {
    $('prestige-count').textContent = `RANK ${data.prestigeCount}`;
    $('prestige-title-label').textContent = data.title;
    $('prestige-bonuses-line').textContent = `Profit ×${data.profitMultiplier.toFixed(2)}`;
    const unlockLines: string[] = [];
    data.unlockedBots.forEach(b => unlockLines.push(`🤖 ${b.charAt(0).toUpperCase()+b.slice(1)} Bot unlocked`));
    data.unlockedAssets.forEach(a => unlockLines.push(`📈 ${a} unlocked`));
    const ul = $('prestige-unlocks');
    ul.innerHTML = unlockLines.map(l => `<div style='color:#cc99ff;font-size:11px;margin:2px 0'>${l}</div>`).join('');
    ul.style.display = unlockLines.length ? 'block' : 'none';
    this.prestigePopup.classList.add('visible');
  }

  showIdleSummary(amount: number, elapsedSeconds: number, botCount: number): void {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
    $('idle-amount').textContent = `+${formatMoney(amount)}`;
    $('idle-time').textContent = `${timeStr} away · ${botCount} bot${botCount !== 1 ? 's' : ''} working`;
    this.idlePopup.classList.add('visible');
  }

  showNameModal(current: string, onConfirm: (name: string) => void): void {
    const modal   = $('name-modal');
    const input   = $('name-input')   as HTMLInputElement;
    const confirm = $('btn-name-confirm') as HTMLButtonElement;
    const random  = $('btn-name-random')  as HTMLButtonElement;

    if (current) input.value = current;
    modal.classList.add('visible');

    const adj  = ['Bull', 'Bear', 'Moon', 'Dark', 'Quant', 'Algo', 'Macro', 'Rekt', 'Degen', 'Based', 'Sigma', 'Chad'];
    const noun = ['Trader', 'Whale', 'Hodler', 'Broker', 'Shark', 'Wolf', 'Oracle', 'Ape', 'Gigabrain'];
    const genName = () => {
      const a = adj[Math.floor(Math.random() * adj.length)];
      const n = noun[Math.floor(Math.random() * noun.length)];
      return `${a}${n}${Math.floor(Math.random() * 9000) + 1000}`;
    };

    const doConfirm = () => {
      const name = input.value.trim() || genName();
      input.value = name;
      onConfirm(name);
      modal.classList.remove('visible');
    };

    random.onclick  = () => { input.value = genName(); };
    confirm.onclick = doConfirm;
    input.onkeydown = (e) => { if (e.key === 'Enter') doConfirm(); };

    // Focus after transition
    setTimeout(() => input.focus(), 100);
  }
}
