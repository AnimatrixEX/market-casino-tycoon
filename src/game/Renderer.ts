// Renderer.ts — all Canvas 2D drawing with juice effects

import { MarketEngine } from './MarketEngine';
import { TradeSystem } from './TradeSystem';
import { JuiceSystem } from './JuiceSystem';

const CHART_PAD_TOP    = 20;
const CHART_PAD_BOTTOM = 30;
const CHART_PAD_LEFT   = 10;
const CHART_PAD_RIGHT  = 10;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  public canvas: HTMLCanvasElement;

  // Screen shake
  private shakeFrames = 0;
  private shakeIntensity = 0;

  // Cached min/max
  private cMinP = 0;
  private cMaxP = 0;

  // Pre-allocated Y coordinate buffer for price line
  private yBuf = new Float32Array(300);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  triggerShake(intensity: number, frames: number): void {
    // Stack shakes: pick the stronger one
    if (intensity > this.shakeIntensity || this.shakeFrames <= 0) {
      this.shakeIntensity = intensity;
      this.shakeFrames = frames;
    }
  }

  render(market: MarketEngine, trades: TradeSystem, liquidationApproaching: boolean, juice: JuiceSystem): void {
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // --- Screen shake ---
    let didShake = false;
    if (this.shakeFrames > 0) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeIntensity *= 0.92; // decay intensity for natural falloff
      this.shakeFrames--;
      ctx.save();
      ctx.translate(sx, sy);
      didShake = true;
    }

    // --- Background ---
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    ctx.fillStyle = isDark ? '#080806' : '#dcd8c8';
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // --- Liquidation warning vignette ---
    if (juice.liqPulse > 0.01) {
      const vignetteAlpha = juice.liqPulse * 0.25;
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, `rgba(255, 30, 0, ${vignetteAlpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }

    // --- Chart area ---
    const chartX = CHART_PAD_LEFT;
    const chartY = CHART_PAD_TOP;
    const chartW = W - CHART_PAD_LEFT - CHART_PAD_RIGHT;
    const chartH = H - CHART_PAD_TOP - CHART_PAD_BOTTOM;

    // Cache min/max
    this.computeMinMax(market);

    this.drawGrid(chartX, chartY, chartW, chartH);
    this.drawPriceLine(chartX, chartY, chartW, chartH, market, trades, liquidationApproaching);

    if (trades.position) {
      this.drawEntryLine(chartX, chartY, chartW, chartH, trades);
      this.drawLiquidationLine(chartX, chartY, chartW, chartH, trades, liquidationApproaching, juice);
    }

    this.drawCurrentPriceGlow(chartX, chartY, chartW, chartH, market, juice);
    this.drawFloatingTexts(ctx, juice, chartX, chartY, chartW, chartH, market);

    // --- Screen flash overlay ---
    const flashAlpha = juice.getFlashAlpha();
    if (flashAlpha > 0.005) {
      ctx.fillStyle = juice.getFlashColor();
      ctx.globalAlpha = flashAlpha;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.globalAlpha = 1;
    }

    if (didShake) {
      ctx.restore();
    }
  }

  private computeMinMax(market: MarketEngine): void {
    const len = market.historyLength;
    let min = market.price, max = market.price;
    for (let i = 0; i < len; i++) {
      const p = market.getPrice(i);
      if (p < min) min = p;
      if (p > max) max = p;
    }
    this.cMinP = min * 0.998;
    this.cMaxP = max * 1.002;
  }

  private priceToY(price: number, chartY: number, chartH: number): number {
    const range = this.cMaxP - this.cMinP || 1;
    return chartY + chartH - ((price - this.cMinP) / range) * chartH;
  }

  private drawGrid(cx: number, cy: number, cw: number, ch: number): void {
    const { ctx } = this;
    const steps = 5;
    ctx.lineWidth = 1;

    for (let i = 0; i <= steps; i++) {
      const y = cy + (ch / steps) * i;
      ctx.strokeStyle = '#141208';
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + cw, y);
      ctx.stroke();

      const price = this.cMaxP - ((this.cMaxP - this.cMinP) / steps) * i;
      ctx.fillStyle = document.documentElement.getAttribute('data-theme') !== 'light' ? '#2a2518' : '#a8a490';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText(price.toFixed(2), cx + 2, y - 3);
    }
  }

  private drawPriceLine(
    cx: number, cy: number, cw: number, ch: number,
    market: MarketEngine, trades: TradeSystem, liquidationApproaching: boolean
  ): void {
    const { ctx } = this;
    const len = market.historyLength;
    if (len < 2) return;

    const step = cw / (len - 1);
    const range = this.cMaxP - this.cMinP || 1;

    // Pre-compute all Y positions into buffer (one pass over ring buffer)
    for (let i = 0; i < len; i++) {
      this.yBuf[i] = cy + ch - ((market.getPrice(i) - this.cMinP) / range) * ch;
    }
    // Force last point to live price so dot always connects to the line
    this.yBuf[len - 1] = cy + ch - ((market.price - this.cMinP) / range) * ch;

    // Line color based on state
    let lineColor = market.color;
    if (trades.position) {
      const pnl = trades.getPnLRatio(market.price);
      if (liquidationApproaching) lineColor = '#ff6600';
      else if (pnl > 0.02) lineColor = '#00d084';
      else if (pnl < -0.02) lineColor = '#ff4444';
      else lineColor = '#6688aa';
    }

    // --- Fill under the line ---
    ctx.beginPath();
    ctx.moveTo(cx, this.yBuf[0]);
    for (let i = 1; i < len; i++) {
      ctx.lineTo(cx + i * step, this.yBuf[i]);
    }
    ctx.lineTo(cx + (len - 1) * step, cy + ch);
    ctx.lineTo(cx, cy + ch);
    ctx.closePath();
    ctx.fillStyle = lineColor + '10';
    ctx.fill();

    // --- Faded old portion ---
    const fadeStart = Math.max(0, len - 80);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (fadeStart > 1) {
      ctx.beginPath();
      ctx.moveTo(cx, this.yBuf[0]);
      for (let i = 1; i < fadeStart; i++) {
        ctx.lineTo(cx + i * step, this.yBuf[i]);
      }
      ctx.strokeStyle = lineColor + '40';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // --- Bright recent portion ---
    const start = Math.max(0, fadeStart - 1);
    ctx.beginPath();
    ctx.moveTo(cx + start * step, this.yBuf[start]);
    for (let i = start + 1; i < len; i++) {
      ctx.lineTo(cx + i * step, this.yBuf[i]);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }

  private drawCurrentPriceGlow(
    cx: number, cy: number, cw: number, ch: number,
    market: MarketEngine, juice: JuiceSystem
  ): void {
    const { ctx } = this;
    const y = this.priceToY(market.price, cy, ch);
    const x = cx + cw;

    // Glow intensity based on price velocity
    const vel = Math.abs(juice.priceVelocity);
    const glowRadius = 8 + Math.min(vel * 30, 20);
    const glowAlpha = 0.15 + Math.min(vel * 8, 0.4);

    // Outer glow
    const glowColor = juice.priceVelocity > 0 ? '0, 208, 132' : '255, 68, 68';
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    glow.addColorStop(0, `rgba(${glowColor}, ${glowAlpha})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);

    // Core dot
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Inner ring
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Price tag at the right edge
    const priceText = market.price.toFixed(2);
    ctx.font = 'bold 11px JetBrains Mono';
    const tw = ctx.measureText(priceText).width;
    const tagX = x - tw - 12;
    const tagY = y;

    ctx.fillStyle = document.documentElement.getAttribute('data-theme') !== 'light' ? '#080806dd' : '#dcd8c8dd';
    ctx.fillRect(tagX - 3, tagY - 7, tw + 6, 14);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(priceText, tagX, tagY + 4);
  }

  private drawLiquidationLine(
    cx: number, cy: number, cw: number, ch: number,
    trades: TradeSystem, liquidationApproaching: boolean, juice: JuiceSystem
  ): void {
    const { ctx } = this;
    const liqPrice = trades.position!.liquidationPrice;
    const y = this.priceToY(liqPrice, cy, ch);

    // Pulsing glow when approaching
    const pulseAlpha = liquidationApproaching ? 0.3 + juice.liqPulse * 0.5 : 0.15;
    const lineColor = liquidationApproaching ? '#ff3300' : '#882200';

    // Danger zone fill
    if (liquidationApproaching) {
      const isLong = trades.position!.side === 'long';
      const fillY = isLong ? y : cy;
      const fillH = isLong ? (cy + ch - y) : (y - cy);
      ctx.fillStyle = `rgba(255, 30, 0, ${0.03 + juice.liqPulse * 0.04})`;
      ctx.fillRect(cx, fillY, cw, fillH);
    }

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = liquidationApproaching ? 2 : 1.5;
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = pulseAlpha + 0.5;

    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + cw, y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Label with background
    const label = `LIQ ${liqPrice.toFixed(2)}`;
    ctx.font = 'bold 10px JetBrains Mono';
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = document.documentElement.getAttribute('data-theme') !== 'light' ? '#080806dd' : '#dcd8c8dd';
    ctx.fillRect(cx + cw - lw - 10, y - 9, lw + 6, 14);
    ctx.fillStyle = lineColor;
    ctx.fillText(label, cx + cw - lw - 7, y + 2);
    ctx.restore();
  }

  private drawEntryLine(
    cx: number, cy: number, cw: number, ch: number,
    trades: TradeSystem
  ): void {
    const { ctx } = this;
    const entryPrice = trades.position!.entryPrice;
    const y = this.priceToY(entryPrice, cy, ch);

    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#444466';
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + cw, y);
    ctx.stroke();

    ctx.setLineDash([]);
    const label = `ENTRY ${entryPrice.toFixed(2)}`;
    ctx.font = '10px JetBrains Mono';
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = document.documentElement.getAttribute('data-theme') !== 'light' ? '#0e0e16cc' : '#dcdceccc';
    ctx.fillRect(cx + 2, y - 9, lw + 6, 14);
    ctx.fillStyle = '#6666aa';
    ctx.fillText(label, cx + 5, y + 2);
    ctx.restore();
  }

  private drawFloatingTexts(
    ctx: CanvasRenderingContext2D, juice: JuiceSystem,
    cx: number, cy: number, cw: number, ch: number,
    market: MarketEngine
  ): void {
    for (const ft of juice.floatingTexts) {
      const alpha = Math.min(1, ft.life / (ft.maxLife * 0.3));
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${ft.size}px JetBrains Mono`;
      // Dark outline for readability (much cheaper than shadowBlur)
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }
}
