// JuiceSystem.ts — visual feedback: floating numbers, screen flashes, value smoothing

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;       // vertical velocity (negative = rises)
  life: number;     // remaining frames
  maxLife: number;
  color: string;
  size: number;
}

export interface ScreenFlash {
  color: string;
  life: number;
  maxLife: number;
  intensity: number; // 0-1
}

export class JuiceSystem {
  public floatingTexts: FloatingText[] = [];
  public flash: ScreenFlash | null = null;

  // Smooth value interpolation targets
  public displayBalance = 0;
  public displayPnl = 0;
  public displayPrice = 0;
  private balanceInitialized = false;

  // Bot activity pulse (0-1, decays)
  public botPulse = 0;

  // Liquidation warning pulse (oscillates 0-1)
  public liqPulse = 0;
  private liqPulsePhase = 0;

  // Price direction tracking for glow
  public priceVelocity = 0;
  private lastPrice = 0;

  tick(actualBalance: number, actualPnl: number, actualPrice: number, isLiqApproaching: boolean): void {
    // --- Smooth value interpolation ---
    if (!this.balanceInitialized) {
      this.displayBalance = actualBalance;
      this.displayPrice = actualPrice;
      this.balanceInitialized = true;
    }
    // Lerp speed: faster for small differences, slower for dramatic changes (more satisfying)
    this.displayBalance += (actualBalance - this.displayBalance) * 0.12;
    this.displayPnl += (actualPnl - this.displayPnl) * 0.15;
    this.displayPrice += (actualPrice - this.displayPrice) * 0.3;

    // Snap when very close
    if (Math.abs(this.displayBalance - actualBalance) < 0.01) this.displayBalance = actualBalance;
    if (Math.abs(this.displayPnl - actualPnl) < 0.01) this.displayPnl = actualPnl;

    // --- Price velocity for glow effect ---
    this.priceVelocity = this.priceVelocity * 0.9 + (actualPrice - this.lastPrice) * 0.1;
    this.lastPrice = actualPrice;

    // --- Floating texts ---
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.vy *= 0.97; // gentle deceleration
      ft.life--;
    }
    // Batch remove dead texts (avoids O(n^2) splice-in-loop)
    if (this.floatingTexts.length > 0 && this.floatingTexts[0].life <= 0) {
      this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
    }

    // --- Screen flash ---
    if (this.flash) {
      this.flash.life--;
      if (this.flash.life <= 0) {
        this.flash = null;
      }
    }

    // --- Bot pulse decay ---
    this.botPulse *= 0.92;

    // --- Liquidation warning pulse ---
    if (isLiqApproaching) {
      this.liqPulsePhase += 0.12;
      this.liqPulse = (Math.sin(this.liqPulsePhase) + 1) * 0.5;
    } else {
      this.liqPulse *= 0.9;
      this.liqPulsePhase = 0;
    }
  }

  // --- Spawn effects ---

  spawnFloatingText(text: string, x: number, y: number, color: string, size = 14): void {
    // Limit to prevent performance issues
    if (this.floatingTexts.length > 15) return;
    this.floatingTexts.push({
      text,
      x: x + (Math.random() - 0.5) * 20,
      y,
      vy: -1.5 - Math.random() * 1.0,
      life: 60,
      maxLife: 60,
      color,
      size,
    });
  }

  triggerFlash(color: string, intensity = 0.3, durationFrames = 12): void {
    this.flash = {
      color,
      life: durationFrames,
      maxLife: durationFrames,
      intensity,
    };
  }

  triggerBotPulse(): void {
    this.botPulse = Math.min(1, this.botPulse + 0.4);
  }

  /** Get flash opacity for current frame (0 if no flash) */
  getFlashAlpha(): number {
    if (!this.flash) return 0;
    const progress = this.flash.life / this.flash.maxLife;
    return this.flash.intensity * progress;
  }

  getFlashColor(): string {
    return this.flash?.color ?? '#fff';
  }
}
