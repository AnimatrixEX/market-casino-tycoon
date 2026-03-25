// AssetConfig.ts — tradeable assets with unique characteristics

export interface AssetConfig {
  id: string;
  label: string;
  symbol: string;
  startPrice: number;
  baseVol: number;
  /** Max leverage cap for this asset (capped against prestige max) */
  leverageCap: number;
  /** Multiplier applied to manual trade PnL (wins AND losses) */
  profitMult: number;
  /** Short description shown in the UI */
  description: string;
  /** Chart line color */
  color: string;
  /** Prestige count required to unlock */
  prestigeRequired: number;
  /** Difficulty rating 1-5 */
  difficulty: number;
  /** Max speedMult allowed for this asset regardless of rank */
  speedCap: number;
}

export const ASSETS: AssetConfig[] = [
  {
    id: 'spx',
    label: 'S&P 500',
    symbol: 'SPX',
    startPrice: 5000,
    baseVol: 0.00015,
    leverageCap: 3,
    profitMult: 1.0,
    description: 'Ultra-stable index. Minimal risk, minimal reward. Perfect for beginners.',
    color: '#00e676',
    prestigeRequired: 0,
    difficulty: 1,
    speedCap: 2.0,
  },
  {
    id: 'gold',
    label: 'Gold',
    symbol: 'Gold',
    startPrice: 2000,
    baseVol: 0.0003,
    leverageCap: 5,
    profitMult: 1.2,
    description: 'Safe haven. Low volatility, low reward.',
    color: '#ffd700',
    prestigeRequired: 1,
    difficulty: 1,
    speedCap: 1.8,
  },
  {
    id: 'btc',
    label: 'Bitcoin',
    symbol: 'BTC',
    startPrice: 1000,
    baseVol: 0.0008,
    leverageCap: 15,
    profitMult: 1.5,
    description: 'Balanced volatility. The reference crypto asset.',
    color: '#f7931a',
    prestigeRequired: 2,
    difficulty: 2,
    speedCap: 1.5,
  },
  {
    id: 'oil',
    label: 'Oil',
    symbol: 'Oil',
    startPrice: 80,
    baseVol: 0.0006,
    leverageCap: 20,
    profitMult: 2.0,
    description: 'Event-driven. Steady moves with occasional spikes.',
    color: '#8b4513',
    prestigeRequired: 3,
    difficulty: 2,
    speedCap: 1.5,
  },
  {
    id: 'eth',
    label: 'Ethereum',
    symbol: 'ETH',
    startPrice: 500,
    baseVol: 0.0013,
    leverageCap: 25,
    profitMult: 3.0,
    description: 'More volatile than BTC. Higher upside and downside.',
    color: '#627eea',
    prestigeRequired: 4,
    difficulty: 3,
    speedCap: 0.9,
  },
  {
    id: 'sol',
    label: 'Solana',
    symbol: 'SOL',
    startPrice: 150,
    baseVol: 0.0022,
    leverageCap: 30,
    profitMult: 5.0,
    description: 'High volatility. Big swings, big rewards — or big losses.',
    color: '#9945ff',
    prestigeRequired: 5,
    difficulty: 4,
    speedCap: 0.7,
  },
  {
    id: 'doge',
    label: 'Dogecoin',
    symbol: 'DOGE',
    startPrice: 0.15,
    baseVol: 0.005,
    leverageCap: 35,
    profitMult: 10.0,
    description: 'Pure chaos. Extreme swings. Not for the faint-hearted.',
    color: '#f5a623',
    prestigeRequired: 6,
    difficulty: 5,
    speedCap: 0.5,
  },
  {
    id: 'pepe',
    label: 'Pepe',
    symbol: 'PEPE',
    startPrice: 0.00001,
    baseVol: 0.015,
    leverageCap: 45,
    profitMult: 25.0,
    description: 'Absolute madness. 100% meme. May go to zero or 100x.',
    color: '#aaff00',
    prestigeRequired: 8,
    difficulty: 5,
    speedCap: 0.35,
  },
];

// Already ordered by profitMult (ascending) — no sort needed

export const ASSET_MAP: Record<string, AssetConfig> = Object.fromEntries(
  ASSETS.map(a => [a.id, a])
);
