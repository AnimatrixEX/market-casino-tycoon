// TutorialSystem.ts — step-by-step tutorial for new players

const TUT_DONE_KEY = 'mct_tutorial_done';

interface TutStep {
  title: string;
  body: string;
  /** Extra body fragment appended only on desktop (pointer: fine) */
  bodyDesktop?: string;
  /** Extra body fragment appended only on touch (pointer: coarse) */
  bodyTouch?: string;
  /** ID of element to draw a highlight ring around */
  targetId?: string;
}

const STEPS: TutStep[] = [
  {
    title: 'Welcome to Market Madness',
    body: 'You start with a <strong>debt to repay</strong>. Trade financial markets to earn money and pay it back.<br><br>Repay your debt to <strong style="color:#aa77ff">rank up</strong> and unlock new assets, bots, and higher leverage.',
  },
  {
    title: 'The Price Chart',
    body: 'The chart shows live price movement. Prices fluctuate constantly based on random events and market conditions.<br><br>Your goal: predict the direction and profit from it.',
    targetId: 'canvas-wrapper',
  },
  {
    title: 'Your Rank & Debt',
    body: 'This area shows your current rank and your debt target.<br><br>Reach the target balance and hit <strong style="color:#aa77ff">REPAY</strong> to rank up. No time pressure — trade at your own pace.',
    targetId: 'header-influence',
  },
  {
    title: 'Opening a Trade',
    body: 'Click <strong style="color:#00d084">LONG ↑</strong> if you think the price will rise.<br>Click <strong style="color:#ff4444">SHORT ↓</strong> if you think it will fall.<br><br>Once in a trade, click <strong>CLOSE</strong> to take profit or cut your loss.',
    targetId: 'action-buttons',
  },
  {
    title: 'Leverage — Power & Risk',
    body: 'The leverage slider amplifies both your gains and your losses.<br><br><span style="color:#ffaa00">Warning: if the price moves too far against you, your position gets <strong>liquidated</strong> — you lose your entire balance.</span><br><br>Start low until you get the feel for it.',
    targetId: 'lev-row-block',
  },
  {
    title: 'Multi-Asset Trading',
    body: 'You can trade <strong>multiple assets simultaneously</strong>. Switch assets using the panel on the left — your open positions stay active in the background.<br><br>The <strong>Trades</strong> tab shows all your open positions and trade history at a glance. Click a position to switch to that asset.',
    targetId: 'tab-bar',
  },
  {
    title: 'Bots — Passive Income',
    body: 'Bots trade automatically for you around the clock, even when you\'re not clicking.<br><br>Open the <strong>Bots</strong> tab and buy some to earn passive income. More bots = faster progress.',
    targetId: 'tab-bar',
  },
  {
    title: 'Rank Up',
    body: 'Once your balance reaches the debt target, head to the <strong>Rank</strong> tab and hit <strong style="color:#aa77ff">REPAY</strong>.<br><br>Each rank unlocks new markets, higher leverage caps, and bigger profit multipliers.',
    targetId: 'header-influence',
  },
  {
    title: "You're Ready!",
    body: 'Trade smart. Build your bot empire. Repay your debts. Rise through the ranks.<br><br><span style="color:#aa77ff">Can you reach the top?</span>',
    bodyDesktop: '<br><br><span style="color:#6677aa;font-size:11px;">Tip: keyboard shortcuts — ↑ Long, ↓ Short, Space to close, 1–5 for tabs.</span>',
    bodyTouch: '<br><br><span style="color:#6677aa;font-size:11px;">Tip: tap Long/Short quickly to catch fast moves. You can hold positions on multiple assets at once!</span>',
  },
];

export class TutorialSystem {
  private overlay:   HTMLElement;
  private highlight: HTMLElement;
  private card:      HTMLElement;
  private stepNum:   HTMLElement;
  private titleEl:   HTMLElement;
  private bodyEl:    HTMLElement;
  private nextBtn:   HTMLButtonElement;
  private skipBtn:   HTMLButtonElement;
  private stepIndex = 0;

  constructor() {
    this.overlay   = document.getElementById('tutorial-overlay')!;
    this.highlight = document.getElementById('tutorial-highlight')!;
    this.card      = document.getElementById('tutorial-card')!;
    this.stepNum   = document.getElementById('tutorial-step-num')!;
    this.titleEl   = document.getElementById('tutorial-title')!;
    this.bodyEl    = document.getElementById('tutorial-body')!;
    this.nextBtn   = document.getElementById('btn-tutorial-next') as HTMLButtonElement;
    this.skipBtn   = document.getElementById('btn-tutorial-skip') as HTMLButtonElement;

    this.nextBtn.addEventListener('click', () => this.next());
    this.skipBtn.addEventListener('click', () => this.complete());
  }

  static isDone(): boolean {
    return !!localStorage.getItem(TUT_DONE_KEY);
  }

  isActive(): boolean {
    return this.overlay.classList.contains('visible');
  }

  start(): void {
    this.stepIndex = 0;
    this.overlay.classList.add('visible');
    this.showStep();
  }

  private static isTouch(): boolean {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  private showStep(): void {
    const step = STEPS[this.stepIndex];
    const total = STEPS.length;

    this.stepNum.textContent = `${this.stepIndex + 1} / ${total}`;
    this.titleEl.textContent = step.title;
    const extra = TutorialSystem.isTouch() ? (step.bodyTouch ?? '') : (step.bodyDesktop ?? '');
    this.bodyEl.innerHTML = step.body + extra;
    this.nextBtn.textContent = this.stepIndex === total - 1 ? "LET'S GO!" : 'Next →';

    // Update progress dots
    const dots = this.overlay.querySelectorAll('.tut-dot');
    dots.forEach((d, i) => {
      d.classList.toggle('tut-dot-active', i === this.stepIndex);
      d.classList.toggle('tut-dot-done', i < this.stepIndex);
    });

    // Position highlight + card after content renders
    requestAnimationFrame(() => this.positionElements(step));
  }

  private positionElements(step: TutStep): void {
    const container = document.getElementById('game-container');
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    const target = step.targetId ? document.getElementById(step.targetId) : null;
    const tRect  = target?.getBoundingClientRect();
    const hasTarget = !!tRect && tRect.width > 20 && tRect.height > 20;

    // --- Highlight ring ---
    if (hasTarget && tRect) {
      const pad = 5;
      this.highlight.style.top    = `${tRect.top    - cRect.top  - pad}px`;
      this.highlight.style.left   = `${tRect.left   - cRect.left - pad}px`;
      this.highlight.style.width  = `${tRect.width  + pad * 2}px`;
      this.highlight.style.height = `${tRect.height + pad * 2}px`;
      this.highlight.style.display = 'block';
    } else {
      this.highlight.style.display = 'none';
    }

    // --- Card position ---
    if (!hasTarget || !tRect) {
      // No target: center
      this.card.style.left      = '50%';
      this.card.style.top       = '50%';
      this.card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const cardW  = this.card.offsetWidth  || 360;
    const cardH  = this.card.offsetHeight || 260;
    const margin = 16;
    const gap    = 20;

    const tTop    = tRect.top    - cRect.top;
    const tBottom = tRect.bottom - cRect.top;
    const tCenterX = (tRect.left + tRect.right) / 2 - cRect.left;

    // Vertical: prefer below, then above, then center
    let top: number;
    if (tBottom + gap + cardH <= cRect.height - margin) {
      top = tBottom + gap;
    } else if (tTop - gap - cardH >= margin) {
      top = tTop - gap - cardH;
    } else {
      top = Math.max(margin, (cRect.height - cardH) / 2);
    }

    // Horizontal: center on target, clamped to container
    let left = tCenterX - cardW / 2;
    left = Math.max(margin, Math.min(left, cRect.width - cardW - margin));

    this.card.style.left      = `${left}px`;
    this.card.style.top       = `${top}px`;
    this.card.style.transform = 'none';
  }

  private next(): void {
    this.stepIndex++;
    if (this.stepIndex >= STEPS.length) {
      this.complete();
    } else {
      this.showStep();
    }
  }

  private complete(): void {
    localStorage.setItem(TUT_DONE_KEY, '1');
    this.overlay.classList.remove('visible');
    this.highlight.style.display = 'none';
  }
}
