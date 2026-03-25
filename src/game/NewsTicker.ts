// NewsTicker.ts — scrolling news headlines that can trigger market micro-events

import type { EventType } from './EventSystem';

export interface NewsItem {
  text: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'danger';
  nudge?: { bias: number; volMult: number; frames: number };
}

export interface ActiveNudge {
  bias: number;
  volMult: number;
  framesLeft: number;
}

export interface FlashNews {
  text: string;
  sentiment: 'bullish' | 'bearish' | 'danger';
  displayFrames: number;
}

// --- Event-triggered news ---
const EVENT_NEWS: Record<EventType, string[]> = {
  pump: [
    'Institutional investors pour billions into the market',
    'Breaking: Major partnership announced, buyers rush in',
    'Analysts upgrade target price to new all-time highs',
    'Retail FOMO kicks in as price breaks resistance',
    'Bull run ignites — momentum traders pile in',
    'Smart money spotted accumulating ahead of rally',
    'Buy-side volume surges as price breaks key level',
    'Market makers pulling asks — supply tightening fast',
    'Options traders betting big on continued upside',
    'Technical breakout confirmed — trend traders go long',
  ],
  crash: [
    'SEC announces surprise investigation into market manipulation',
    'Breaking: Exchange hack reported, panic selling ensues',
    'Major fund liquidated, cascading sell-offs triggered',
    'Negative earnings report sends market into freefall',
    'Support levels obliterated — stop-losses triggered en masse',
    'Fear index spikes to extreme levels as sell-off deepens',
    'Margin calls flood the system — forced liquidations accelerating',
    'Institutional players exit positions — retail left holding bags',
    'Bear market confirmed: -20% from recent peak',
    'Panic selling spreads across all asset classes',
  ],
  fake_pump: [
    'Unverified rumors of major acquisition circulate online',
    'Influencer tweets bullish prediction — source unclear',
    'Suspicious buy orders detected on multiple exchanges',
    'Anonymous social media account claims insider knowledge',
    'Coordinated pump detected — be cautious of the exit dump',
    'Viral post sparks buying frenzy — fundamentals unchanged',
    'Celebrity endorsement fuels speculation — no official statement',
  ],
  volatility_spike: [
    'Fed chair hints at policy change — markets react wildly',
    'Conflicting economic data creates uncertainty',
    'Options expiry day: expect extreme price swings',
    'Volatility index hits 6-month high — traders brace for chaos',
    'Bid-ask spreads widen dramatically — liquidity evaporating',
    'Algo warfare: opposing bots triggering each other in feedback loop',
    'Market makers step back — price discovery entering chaos mode',
  ],
  whale_buy: [
    'WHALE ALERT: $500M buy order detected on-chain',
    'Anonymous whale accumulating massive position',
    'Insider report: mega fund entering long position',
    'WHALE ALERT: Single wallet absorbs entire sell-side book',
    'On-chain data shows 10,000 BTC moved to cold storage — bullish signal',
    'Dark pool activity surges — institutions quietly accumulating',
    'Whales accumulating in silence while retail panics',
  ],
  whale_sell: [
    'WHALE ALERT: $500M sell order hits the market',
    'Early investor moving tokens to exchange — dump incoming?',
    'Large holder liquidating position after 2 years',
    'WHALE ALERT: 50,000 units transferred to exchange wallet',
    'Long-term holder distribution event detected — watch for pressure',
    'OTC desk flooded with sell orders from high-net-worth clients',
    'Fund manager reduces exposure — risk-off mode engaged',
  ],
  flash_crash: [
    'CRITICAL: Liquidity pool drained, price in freefall',
    'Algorithm malfunction triggers cascading liquidations',
    'Flash crash detected — circuit breakers offline',
    'CRITICAL: Market depth collapsed — orders falling through the book',
    'Spoofing detected: massive fake bid wall pulled, price nosedives',
    'Exchange matching engine lag causes catastrophic mispricing',
    'Stop-loss cascade: $1.5B liquidated in under 90 seconds',
  ],
  dead_cat_bounce: [
    'Bargain hunters step in after steep decline',
    'Technical rebound expected — but is it sustainable?',
    'Dead cat bounce or real recovery? Analysts divided',
    'Short-term buyers emerge at oversold levels — caution advised',
    'Relief rally underway — but selling pressure still lurks above',
    'Weak-handed shorts cover — temporary bounce, underlying trend intact',
  ],
  short_squeeze: [
    'Short sellers trapped as price explodes upward',
    'Massive short liquidation cascade underway',
    'Bears getting crushed — short interest at record highs',
    'SHORT SQUEEZE: $800M in short positions forcibly closed',
    'Gamma squeeze adding fuel to the fire — delta hedging accelerates rally',
    'Short ratio hits extreme — rocket fuel loading',
  ],
  bull_trap: [
    'Price breaks above key resistance — but volume is thin',
    'Rally looks promising but smart money is selling quietly',
    'Breakout or fakeout? The market will decide shortly',
    'False breakout spotted — institutional sellers absorbing retail buys',
    'Warning: rally driven by low volume — conviction lacking',
    'Distribution pattern forming at resistance — trap may be set',
  ],
};

// --- Asset-specific ambient news ---
const ASSET_NEWS: Record<string, string[]> = {
  btc: [
    'Bitcoin dominance rises as altcoins bleed',
    'Lightning Network capacity hits all-time high',
    'Mining difficulty adjusts upward — hashrate surging',
    'Bitcoin ETF sees record daily inflows',
    'Satoshi wallet moves — market watches nervously',
    'BTC long-term holders reach all-time high',
    'Major nation considering Bitcoin legal tender status',
    'MicroStrategy adds 10,000 BTC to treasury reserves',
    'Bitcoin mempool congestion sends fees soaring',
    'Halving countdown: less than 200 days remaining',
  ],
  eth: [
    'Ethereum gas fees drop to yearly lows — DeFi activity spikes',
    'Layer 2 TVL surpasses $50B milestone',
    'Ethereum staking rate hits new record — supply squeeze incoming',
    'Major DeFi protocol launches on Ethereum mainnet',
    'ETH burn rate accelerates post EIP-1559 update',
    'Vitalik proposes new scaling solution — community excited',
    'Ethereum futures open interest at all-time high',
    'Smart contract deployments hit monthly record',
  ],
  sol: [
    'Solana TPS record broken — 100,000 transactions per second',
    'Major NFT collection mints on Solana — network stress test',
    'Solana validator count surpasses 2,000',
    'Solana DeFi ecosystem doubles in 30 days',
    'Firedancer client passes testnet stress test',
    'SOL staking rewards attract yield hunters',
    'Solana Mobile phone sells out in 24 hours',
  ],
  doge: [
    'Elon Musk tweets a meme — DOGE price reacts immediately',
    'Dogecoin accepted at major online retailer',
    'Doge community organizes another charitable initiative',
    'Meme stocks and meme coins surge in tandem',
    '1 Doge = 1 Doge — community maintains zen-like calm',
    'Reddit community mobilizes behind DOGE once again',
    'Dogecoin transaction volume spikes 400% overnight',
  ],
  gold: [
    'Gold demand from central banks hits 55-year high',
    'Safe-haven buying accelerates amid global uncertainty',
    'Gold/Silver ratio reaches historic extreme',
    'Bullion banks increase physical gold reserves',
    'Inflation fears drive retail gold buying surge',
    'Gold miners report record profit margins',
    'ETF gold holdings increase for 12th consecutive day',
    'Dollar weakness boosts gold appeal for foreign buyers',
  ],
  spx: [
    'S&P 500 hits all-time high — passive investors celebrate',
    'Index funds absorbing record inflows this quarter',
    'Magnificent 7 stocks drag S&P higher despite weak breadth',
    'S&P 500 forward P/E reaches 22x — stretched but climbing',
    'Dividend aristocrats outperform as defensives rotate in',
    'ETF rebalancing flows push index to new record close',
    'S&P volatility index (VIX) collapses to 12 — complacency rising',
    'Retail investors buy every dip — index resilience impressive',
  ],
  pepe: [
    'Elon posts frog emoji — PEPE volume explodes 10,000%',
    'PEPE listed on major exchange — meme traders go wild',
    'Frog army mobilizes on social media — community hype at peak',
    'PEPE briefly flips DOGE in market cap — internet loses its mind',
    'Anonymous whale buys 500 billion PEPE — dev wallet moves',
    'PEPE burns 10 trillion tokens — supply shock imminent',
    'New PEPE meme goes viral — price disconnects from reality',
    'PEPE holders refuse to sell — diamond hands meme spreading',
  ],
  oil: [
    'OPEC+ announces surprise production cut',
    'US crude inventories fall sharply — supply tightening',
    'Geopolitical tension in oil-producing region spikes',
    'Demand forecast raised by IEA — bullish for oil prices',
    'Refinery outage tightens refined product supply',
    'Oil tanker traffic at record highs in key straits',
    'Energy transition concerns weigh on long-term oil outlook',
    'Brent/WTI spread widens as regional demand diverges',
  ],
};

// --- Generic ambient news ---
interface AmbientNewsDef {
  text: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'danger';
  nudge?: { bias: number; volMult: number; frames: number };
}

const AMBIENT_NEWS: AmbientNewsDef[] = [
  // Bullish
  { text: 'Positive jobs report released — markets optimistic', sentiment: 'bullish', nudge: { bias: 0.12, volMult: 1.2, frames: 60 } },
  { text: 'Tech giant beats quarterly earnings by 15%', sentiment: 'bullish', nudge: { bias: 0.10, volMult: 1.1, frames: 50 } },
  { text: 'New regulatory framework welcomed by investors', sentiment: 'bullish', nudge: { bias: 0.08, volMult: 1.1, frames: 40 } },
  { text: 'Strong consumer confidence index lifts sentiment', sentiment: 'bullish', nudge: { bias: 0.06, volMult: 1.0, frames: 30 } },
  { text: 'Central bank signals continued support for markets', sentiment: 'bullish', nudge: { bias: 0.10, volMult: 1.15, frames: 45 } },
  { text: 'Major bank raises market outlook to "overweight"', sentiment: 'bullish', nudge: { bias: 0.07, volMult: 1.05, frames: 35 } },
  { text: 'Supply chain improvements boost manufacturing sector', sentiment: 'bullish', nudge: { bias: 0.05, volMult: 1.0, frames: 30 } },
  { text: 'Record inflows into equity funds this week', sentiment: 'bullish', nudge: { bias: 0.08, volMult: 1.1, frames: 40 } },
  { text: 'G7 leaders agree on pro-growth fiscal package', sentiment: 'bullish', nudge: { bias: 0.09, volMult: 1.1, frames: 45 } },
  { text: 'GDP growth exceeds forecasts — economy roaring', sentiment: 'bullish', nudge: { bias: 0.11, volMult: 1.2, frames: 55 } },
  { text: 'Retail sales surge — consumer spending at record pace', sentiment: 'bullish', nudge: { bias: 0.07, volMult: 1.05, frames: 35 } },
  { text: 'M&A activity heats up — deal-making frenzy drives optimism', sentiment: 'bullish', nudge: { bias: 0.08, volMult: 1.1, frames: 40 } },
  { text: 'Sovereign wealth fund announces $10B allocation to risk assets', sentiment: 'bullish', nudge: { bias: 0.13, volMult: 1.25, frames: 60 } },
  { text: 'Pension fund rebalancing drives strong buy-side flows', sentiment: 'bullish', nudge: { bias: 0.06, volMult: 1.05, frames: 30 } },
  { text: 'Technical analysts: golden cross forming on weekly chart', sentiment: 'bullish', nudge: { bias: 0.09, volMult: 1.15, frames: 50 } },

  // Bearish
  { text: 'Inflation data comes in hotter than expected', sentiment: 'bearish', nudge: { bias: -0.12, volMult: 1.3, frames: 60 } },
  { text: 'Geopolitical tensions escalate in key region', sentiment: 'bearish', nudge: { bias: -0.10, volMult: 1.2, frames: 50 } },
  { text: 'Bond yields spike to multi-year highs', sentiment: 'bearish', nudge: { bias: -0.08, volMult: 1.15, frames: 45 } },
  { text: 'Major retailer issues profit warning', sentiment: 'bearish', nudge: { bias: -0.06, volMult: 1.05, frames: 30 } },
  { text: 'Trade deficit widens more than forecast', sentiment: 'bearish', nudge: { bias: -0.07, volMult: 1.1, frames: 40 } },
  { text: 'Housing market data shows signs of cooling', sentiment: 'bearish', nudge: { bias: -0.05, volMult: 1.05, frames: 35 } },
  { text: 'Credit rating agency downgrades sovereign debt', sentiment: 'bearish', nudge: { bias: -0.10, volMult: 1.2, frames: 50 } },
  { text: 'Unemployment claims rise unexpectedly', sentiment: 'bearish', nudge: { bias: -0.09, volMult: 1.15, frames: 45 } },
  { text: 'Factory output contracts for third month in a row', sentiment: 'bearish', nudge: { bias: -0.08, volMult: 1.1, frames: 40 } },
  { text: 'Consumer sentiment drops to 18-month low', sentiment: 'bearish', nudge: { bias: -0.07, volMult: 1.1, frames: 40 } },
  { text: 'Recession probability raised to 65% by leading forecasters', sentiment: 'bearish', nudge: { bias: -0.11, volMult: 1.2, frames: 50 } },
  { text: 'Corporate bankruptcies tick higher — credit stress rising', sentiment: 'bearish', nudge: { bias: -0.09, volMult: 1.15, frames: 45 } },
  { text: 'Fed minutes reveal more hawkish tone than expected', sentiment: 'bearish', nudge: { bias: -0.10, volMult: 1.2, frames: 50 } },
  { text: 'Regional banking sector shows signs of stress', sentiment: 'bearish', nudge: { bias: -0.12, volMult: 1.3, frames: 55 } },
  { text: 'Supply chain disruption returns — shipping costs double', sentiment: 'bearish', nudge: { bias: -0.08, volMult: 1.1, frames: 40 } },

  // Neutral / flavor
  { text: 'Markets consolidate in tight range ahead of Fed meeting', sentiment: 'neutral' },
  { text: 'Trading volume below average as traders await catalyst', sentiment: 'neutral' },
  { text: 'Analysts remain divided on short-term market direction', sentiment: 'neutral' },
  { text: 'Cryptocurrency regulation debate continues in Congress', sentiment: 'neutral' },
  { text: 'Earnings season kicks off next week — brace yourselves', sentiment: 'neutral' },
  { text: 'Market sentiment index sits at neutral territory', sentiment: 'neutral' },
  { text: 'Options market pricing in higher volatility ahead', sentiment: 'neutral', nudge: { bias: 0, volMult: 1.3, frames: 45 } },
  { text: 'New IPO wave expected to absorb market liquidity', sentiment: 'neutral' },
  { text: 'Algo trading accounts for 78% of volume today', sentiment: 'neutral' },
  { text: 'Social media buzz around market at 6-month high', sentiment: 'neutral' },
  { text: 'Cross-asset correlations rising — diversification weakening', sentiment: 'neutral' },
  { text: 'Quarter-end rebalancing flows distorting price action', sentiment: 'neutral', nudge: { bias: 0, volMult: 1.2, frames: 40 } },
  { text: 'Jackson Hole symposium kicks off — markets in wait-and-see mode', sentiment: 'neutral' },
  { text: 'Derivatives market signals: 48% bullish, 52% bearish', sentiment: 'neutral' },
  { text: 'Thin holiday liquidity amplifying every price move', sentiment: 'neutral', nudge: { bias: 0, volMult: 1.4, frames: 60 } },
  { text: 'CPI report due tomorrow — positioning cautious', sentiment: 'neutral' },
  { text: 'Treasury auction draws solid demand — yields stable', sentiment: 'neutral' },
  { text: 'Market breadth narrowing — rally concentrated in few names', sentiment: 'neutral' },
  { text: 'Risk appetite steady — VIX below 20 for 10th straight day', sentiment: 'neutral' },
  { text: 'Seasonal patterns suggest choppy trading ahead', sentiment: 'neutral' },


  // Bullish — extra
  { text: 'Warren Buffett reveals surprise stake in the market', sentiment: 'bullish', nudge: { bias: 0.11, volMult: 1.2, frames: 55 } },
  { text: 'Buyback program announced — B in shares to be repurchased', sentiment: 'bullish', nudge: { bias: 0.09, volMult: 1.1, frames: 45 } },
  { text: 'IMF upgrades global growth forecast — risk-on rally begins', sentiment: 'bullish', nudge: { bias: 0.10, volMult: 1.15, frames: 50 } },
  { text: 'Hedge fund titan: "we are in the early stages of a mega-bull run"', sentiment: 'bullish', nudge: { bias: 0.12, volMult: 1.2, frames: 55 } },
  { text: 'Breakout confirmed on weekly timeframe — bulls in control', sentiment: 'bullish', nudge: { bias: 0.10, volMult: 1.15, frames: 50 } },
  { text: 'Insider buying surges — executives loading up on their own stock', sentiment: 'bullish', nudge: { bias: 0.08, volMult: 1.1, frames: 40 } },
  { text: 'Inflation prints at 12-month low — rate cuts back on the table', sentiment: 'bullish', nudge: { bias: 0.13, volMult: 1.25, frames: 60 } },
  { text: 'Trade deal signed between major economies — supply chains ease', sentiment: 'bullish', nudge: { bias: 0.09, volMult: 1.1, frames: 45 } },
  { text: 'Short interest at record lows — bears have given up', sentiment: 'bullish', nudge: { bias: 0.07, volMult: 1.05, frames: 35 } },
  { text: 'AI investment wave triggers broad market optimism', sentiment: 'bullish', nudge: { bias: 0.10, volMult: 1.15, frames: 50 } },
  { text: 'Dividend yield hits 5-year high — income investors pile in', sentiment: 'bullish', nudge: { bias: 0.06, volMult: 1.0, frames: 30 } },
  { text: 'Emerging market rally lifts global risk appetite', sentiment: 'bullish', nudge: { bias: 0.08, volMult: 1.1, frames: 40 } },

  // Bearish — extra
  { text: 'Oil price shock threatens to reignite inflation fears', sentiment: 'bearish', nudge: { bias: -0.10, volMult: 1.2, frames: 50 } },
  { text: 'Tech sector layoffs accelerate — 50,000 jobs cut this quarter', sentiment: 'bearish', nudge: { bias: -0.08, volMult: 1.1, frames: 40 } },
  { text: 'Yield curve inversion deepens — recession signal blinking red', sentiment: 'bearish', nudge: { bias: -0.11, volMult: 1.2, frames: 55 } },
  { text: 'Dollar strengthens sharply — pressure on all risk assets', sentiment: 'bearish', nudge: { bias: -0.09, volMult: 1.15, frames: 45 } },
  { text: 'PMI falls below 50 for third consecutive month', sentiment: 'bearish', nudge: { bias: -0.07, volMult: 1.1, frames: 40 } },
  { text: 'Hedge funds increase net short positions to 3-year high', sentiment: 'bearish', nudge: { bias: -0.10, volMult: 1.2, frames: 50 } },
  { text: 'Corporate debt defaults rising — credit markets flashing warnings', sentiment: 'bearish', nudge: { bias: -0.09, volMult: 1.15, frames: 45 } },
  { text: 'Capital outflows from emerging markets hit 18-month peak', sentiment: 'bearish', nudge: { bias: -0.08, volMult: 1.1, frames: 40 } },
  { text: 'Bank of Japan unexpectedly tightens policy — yen carry trade unwinds', sentiment: 'bearish', nudge: { bias: -0.13, volMult: 1.35, frames: 60 } },
  { text: 'Retail investors capitulating — sentiment survey hits despair zone', sentiment: 'bearish', nudge: { bias: -0.08, volMult: 1.1, frames: 40 } },
  { text: 'Margin debt falls sharply — deleveraging accelerating', sentiment: 'bearish', nudge: { bias: -0.10, volMult: 1.2, frames: 50 } },
  { text: 'Energy crisis resurfaces — power shortages hit industrial output', sentiment: 'bearish', nudge: { bias: -0.09, volMult: 1.15, frames: 45 } },

  // Neutral — extra
  { text: 'Quant funds rebalancing — expect unusual price action today', sentiment: 'neutral', nudge: { bias: 0, volMult: 1.25, frames: 50 } },
  { text: 'FOMC meeting minutes due in 2 hours — traders holding their breath', sentiment: 'neutral' },
  { text: 'Dark pool volume unusually high — institutional intent unclear', sentiment: 'neutral', nudge: { bias: 0, volMult: 1.15, frames: 40 } },
  { text: 'Weekend gap risk elevated — position sizing advisable', sentiment: 'neutral' },
  { text: 'Market makers widening spreads — caution in thin tape', sentiment: 'neutral', nudge: { bias: 0, volMult: 1.2, frames: 40 } },
  { text: 'Both bulls and bears cite same data — nobody knows anything', sentiment: 'neutral' },
  { text: 'Correlation between stocks and bonds breaks down again', sentiment: 'neutral' },
  { text: 'VIX term structure shifts — near-term uncertainty rising', sentiment: 'neutral', nudge: { bias: 0, volMult: 1.3, frames: 50 } },
  { text: 'Large block trades detected — someone knows something', sentiment: 'neutral' },
  { text: 'Options expiry Friday: max pain theory points to flat close', sentiment: 'neutral' },
  { text: 'Retail traders record 2.3M new accounts opened this month', sentiment: 'neutral' },
  { text: 'Central bank digital currency pilot announced — mixed reactions', sentiment: 'neutral' },
  { text: 'Analyst upgrades and downgrades cancel each other out today', sentiment: 'neutral' },
  { text: 'Low volatility regime persists — calm before the storm?', sentiment: 'neutral' },
  { text: 'Market closed tomorrow for public holiday — liquidity will be thin', sentiment: 'neutral' },

  // Danger — extra
  { text: 'ALERT: Unregulated exchange shows signs of exit scam', sentiment: 'danger', nudge: { bias: -0.14, volMult: 1.8, frames: 70 } },
  { text: 'Anonymous whistleblower leaks damning financial documents', sentiment: 'danger', nudge: { bias: -0.11, volMult: 1.5, frames: 60 } },
  { text: 'Regulators freeze assets of major market participant', sentiment: 'danger', nudge: { bias: -0.13, volMult: 1.7, frames: 65 } },
  { text: 'ALERT: Ponzi scheme collapse triggers B in losses', sentiment: 'danger', nudge: { bias: -0.16, volMult: 1.9, frames: 75 } },
  { text: 'Systemic risk model flags extreme tail event probability', sentiment: 'danger', nudge: { bias: -0.12, volMult: 1.6, frames: 60 } },
  { text: 'RUMOR: Central bank intervention imminent — panic in the pits', sentiment: 'danger', nudge: { bias: -0.10, volMult: 1.5, frames: 55 } },
  // Danger
  { text: 'RUMOR: Large exchange facing solvency issues', sentiment: 'danger', nudge: { bias: -0.15, volMult: 1.5, frames: 70 } },
  { text: 'Suspicious trading patterns detected by regulators', sentiment: 'danger', nudge: { bias: -0.08, volMult: 1.4, frames: 50 } },
  { text: 'BREAKING: Unconfirmed reports of emergency rate hike', sentiment: 'danger', nudge: { bias: -0.12, volMult: 1.6, frames: 60 } },
  { text: 'Warning: coordinated manipulation attempt detected', sentiment: 'danger', nudge: { bias: -0.10, volMult: 1.5, frames: 55 } },
  { text: 'ALERT: Major smart contract exploit drains $200M', sentiment: 'danger', nudge: { bias: -0.14, volMult: 1.7, frames: 65 } },
  { text: 'Nuclear escalation warning issued — markets in shock', sentiment: 'danger', nudge: { bias: -0.18, volMult: 2.0, frames: 80 } },
  { text: 'ALERT: Contagion spreading from collapsed hedge fund', sentiment: 'danger', nudge: { bias: -0.13, volMult: 1.6, frames: 60 } },
];

// --- Flash news ---
interface FlashNewsDef {
  text: string;
  sentiment: 'bullish' | 'bearish' | 'danger';
  nudge: { bias: number; volMult: number; frames: number };
}

const FLASH_NEWS: FlashNewsDef[] = [
  // Bullish shocks
  { text: '🚨 BREAKING: Federal Reserve cuts rates by 100bps in emergency session', sentiment: 'bullish', nudge: { bias: 0.75, volMult: 3.5, frames: 180 } },
  { text: '🚨 BREAKING: BlackRock acquires 5% stake — massive institutional buy signal', sentiment: 'bullish', nudge: { bias: 0.60, volMult: 2.8, frames: 150 } },
  { text: '🚨 FLASH: Short squeeze detonates — $2B in shorts liquidated in minutes', sentiment: 'bullish', nudge: { bias: 0.80, volMult: 4.0, frames: 120 } },
  { text: '🚨 BREAKING: ETF approval granted — flood of institutional money incoming', sentiment: 'bullish', nudge: { bias: 0.65, volMult: 3.0, frames: 160 } },
  { text: '🚨 FLASH: Nation-state announces strategic reserve purchase', sentiment: 'bullish', nudge: { bias: 0.70, volMult: 3.2, frames: 140 } },
  { text: '🚨 BREAKING: World\'s largest hedge fund reveals massive long position', sentiment: 'bullish', nudge: { bias: 0.55, volMult: 2.5, frames: 130 } },
  { text: '🚨 FLASH: Legendary investor goes all-in — "once in a decade opportunity"', sentiment: 'bullish', nudge: { bias: 0.50, volMult: 2.2, frames: 120 } },
  { text: '🚨 BREAKING: Surprise M&A deal — premium of 80% over current price', sentiment: 'bullish', nudge: { bias: 0.90, volMult: 4.5, frames: 100 } },
  { text: '🚨 FLASH: G20 leaders announce joint stimulus package — risk-on surge', sentiment: 'bullish', nudge: { bias: 0.60, volMult: 2.8, frames: 150 } },
  { text: '🚨 BREAKING: Central bank pivots to QE infinity — liquidity flood incoming', sentiment: 'bullish', nudge: { bias: 0.70, volMult: 3.5, frames: 180 } },
  { text: '🚨 FLASH: Record-breaking gamma squeeze — MMs forced to buy aggressively', sentiment: 'bullish', nudge: { bias: 0.85, volMult: 4.2, frames: 110 } },
  { text: '🚨 BREAKING: Trillion-dollar sovereign fund doubles allocation to risk assets', sentiment: 'bullish', nudge: { bias: 0.65, volMult: 3.0, frames: 145 } },

  // Bearish/Danger shocks
  { text: '🚨 BREAKING: Exchange halts withdrawals — insolvency fears grip the market', sentiment: 'danger', nudge: { bias: -0.85, volMult: 5.0, frames: 200 } },
  { text: '🚨 FLASH CRASH: Algorithmic cascade wipes $400B from markets in 3 minutes', sentiment: 'danger', nudge: { bias: -0.90, volMult: 6.0, frames: 90 } },
  { text: '🚨 BREAKING: SEC launches emergency enforcement action — trading suspended', sentiment: 'danger', nudge: { bias: -0.75, volMult: 4.0, frames: 180 } },
  { text: '🚨 BREAKING: Fed hikes rates by 150bps — largest increase in 40 years', sentiment: 'bearish', nudge: { bias: -0.65, volMult: 3.5, frames: 170 } },
  { text: '🚨 FLASH: Stablecoin depegs — contagion spreading across the market', sentiment: 'danger', nudge: { bias: -0.80, volMult: 5.0, frames: 150 } },
  { text: '🚨 BREAKING: Major fraud uncovered — CEO arrested, assets frozen', sentiment: 'danger', nudge: { bias: -0.70, volMult: 4.2, frames: 160 } },
  { text: '🚨 FLASH: Whale dumps entire $1.2B position — panic selling accelerates', sentiment: 'bearish', nudge: { bias: -0.60, volMult: 3.0, frames: 130 } },
  { text: '🚨 BREAKING: Massive leverage unwind — 50,000 positions liquidated in 60s', sentiment: 'danger', nudge: { bias: -0.55, volMult: 3.5, frames: 140 } },
  { text: '🚨 FLASH: Geopolitical crisis escalates — risk-off wave hits all markets', sentiment: 'bearish', nudge: { bias: -0.50, volMult: 2.8, frames: 150 } },
  { text: '🚨 BREAKING: Systemic risk alert issued by BIS — global credit crunch feared', sentiment: 'danger', nudge: { bias: -0.80, volMult: 4.5, frames: 180 } },
  { text: '🚨 FLASH: Black swan event detected — tail risk models going haywire', sentiment: 'danger', nudge: { bias: -0.95, volMult: 6.5, frames: 120 } },
  { text: '🚨 BREAKING: Coordinated cyberattack on financial infrastructure — chaos ensues', sentiment: 'danger', nudge: { bias: -0.75, volMult: 5.0, frames: 160 } },
  { text: '🚨 FLASH: Death cross confirmed on monthly chart — bears in full control', sentiment: 'bearish', nudge: { bias: -0.55, volMult: 2.5, frames: 140 } },
];


// --- Asset-specific flash news ---
const ASSET_FLASH_NEWS: Record<string, FlashNewsDef[]> = {
  btc: [
    { text: '🚨 BREAKING: Bitcoin spot ETF sees \B single-day inflow — biggest in history', sentiment: 'bullish', nudge: { bias: 0.80, volMult: 4.0, frames: 160 } },
    { text: '🚨 FLASH: Bitcoin halving triggers supply shock — miners stop selling', sentiment: 'bullish', nudge: { bias: 0.70, volMult: 3.2, frames: 150 } },
    { text: '🚨 BREAKING: MicroStrategy buys 50,000 BTC in single transaction', sentiment: 'bullish', nudge: { bias: 0.65, volMult: 3.0, frames: 140 } },
    { text: '🚨 FLASH: El Salvador announces BTC legal tender expansion — other nations follow', sentiment: 'bullish', nudge: { bias: 0.55, volMult: 2.8, frames: 130 } },
    { text: '🚨 BREAKING: Major exchange halts BTC withdrawals — insolvency rumored', sentiment: 'danger', nudge: { bias: -0.85, volMult: 5.0, frames: 180 } },
    { text: '🚨 FLASH: US government dumps 200,000 seized BTC — market panics', sentiment: 'danger', nudge: { bias: -0.75, volMult: 4.5, frames: 160 } },
    { text: '🚨 BREAKING: China bans Bitcoin mining again — hashrate collapses', sentiment: 'bearish', nudge: { bias: -0.60, volMult: 3.5, frames: 150 } },
    { text: '🚨 FLASH: Bitcoin mining pool cartel detected — 51% attack feared', sentiment: 'danger', nudge: { bias: -0.70, volMult: 4.0, frames: 140 } },
  ],
  eth: [
    { text: '🚨 BREAKING: Ethereum Layer 2 TVL surpasses  B — adoption explodes', sentiment: 'bullish', nudge: { bias: 0.75, volMult: 3.8, frames: 155 } },
    { text: '🚨 FLASH: Major DeFi protocol launches on ETH —  B TVL in 24h', sentiment: 'bullish', nudge: { bias: 0.65, volMult: 3.2, frames: 140 } },
    { text: '🚨 BREAKING: Ethereum staking rate hits 40% — massive supply shock', sentiment: 'bullish', nudge: { bias: 0.60, volMult: 3.0, frames: 145 } },
    { text: '🚨 FLASH: Critical Ethereum vulnerability discovered — all nodes patching', sentiment: 'danger', nudge: { bias: -0.80, volMult: 5.0, frames: 170 } },
    { text: '🚨 BREAKING: \B DeFi exploit drains top Ethereum protocol', sentiment: 'danger', nudge: { bias: -0.75, volMult: 4.5, frames: 160 } },
    { text: '🚨 FLASH: Ethereum hard fork controversy splits community — ETH classic déjà vu', sentiment: 'bearish', nudge: { bias: -0.55, volMult: 3.5, frames: 140 } },
  ],
  sol: [
    { text: '🚨 BREAKING: Solana processes 1M TPS milestone — developers flood in', sentiment: 'bullish', nudge: { bias: 0.80, volMult: 4.0, frames: 150 } },
    { text: '🚨 FLASH: Major US retailer adopts Solana Pay — 10M transactions/day', sentiment: 'bullish', nudge: { bias: 0.70, volMult: 3.5, frames: 140 } },
    { text: '🚨 BREAKING: Firedancer client goes live — network capacity 10x', sentiment: 'bullish', nudge: { bias: 0.65, volMult: 3.2, frames: 135 } },
    { text: '🚨 FLASH: Solana network outage — all transactions halted', sentiment: 'danger', nudge: { bias: -0.85, volMult: 5.5, frames: 180 } },
    { text: '🚨 BREAKING: Solana validator cartel detected — decentralization concerns', sentiment: 'bearish', nudge: { bias: -0.60, volMult: 3.8, frames: 150 } },
    { text: '🚨 FLASH: FTX estate dumps entire SOL position —  M hits market', sentiment: 'danger', nudge: { bias: -0.80, volMult: 4.8, frames: 160 } },
  ],
  doge: [
    { text: '🚨 BREAKING: Elon Musk changes Twitter/X logo to Doge — again', sentiment: 'bullish', nudge: { bias: 0.90, volMult: 5.0, frames: 120 } },
    { text: '🚨 FLASH: DOGE accepted as payment by Tesla — community erupts', sentiment: 'bullish', nudge: { bias: 0.85, volMult: 4.5, frames: 130 } },
    { text: '🚨 BREAKING: SpaceX announces DOGE-funded satellite mission', sentiment: 'bullish', nudge: { bias: 0.75, volMult: 4.0, frames: 125 } },
    { text: '🚨 FLASH: Elon Musk sells all DOGE holdings — community in shock', sentiment: 'danger', nudge: { bias: -0.90, volMult: 6.0, frames: 140 } },
    { text: '🚨 BREAKING: DOGE original dev dumps 10 year old wallet — massive sell pressure', sentiment: 'danger', nudge: { bias: -0.80, volMult: 5.0, frames: 150 } },
    { text: '🚨 FLASH: Meme coin supercycle ends — retail capitulation detected', sentiment: 'bearish', nudge: { bias: -0.65, volMult: 3.5, frames: 140 } },
  ],
  gold: [
    { text: '🚨 BREAKING: Central banks buy record 1,000 tons of gold in single quarter', sentiment: 'bullish', nudge: { bias: 0.70, volMult: 3.5, frames: 160 } },
    { text: '🚨 FLASH: Dollar collapse fears surge — gold safe-haven demand explodes', sentiment: 'bullish', nudge: { bias: 0.75, volMult: 3.8, frames: 155 } },
    { text: '🚨 BREAKING: Major geopolitical conflict escalates — gold hits \,000/oz', sentiment: 'bullish', nudge: { bias: 0.80, volMult: 4.0, frames: 160 } },
    { text: '🚨 FLASH: IMF proposes return to gold standard — markets stunned', sentiment: 'bullish', nudge: { bias: 0.65, volMult: 3.2, frames: 145 } },
    { text: '🚨 BREAKING: Risk-on surge triggers massive gold liquidation', sentiment: 'bearish', nudge: { bias: -0.65, volMult: 3.5, frames: 150 } },
    { text: '🚨 FLASH: Central bank sells gold reserves to fund budget — supply shock', sentiment: 'bearish', nudge: { bias: -0.60, volMult: 3.2, frames: 140 } },
    { text: '🚨 BREAKING: New gold deposits discovered — largest find in 50 years', sentiment: 'bearish', nudge: { bias: -0.55, volMult: 3.0, frames: 135 } },
  ],
  oil: [
    { text: '🚨 BREAKING: OPEC+ announces emergency 5M barrel/day production cut', sentiment: 'bullish', nudge: { bias: 0.80, volMult: 4.2, frames: 160 } },
    { text: '🚨 FLASH: Major oil pipeline attacked — 30% of supply disrupted', sentiment: 'bullish', nudge: { bias: 0.75, volMult: 4.0, frames: 155 } },
    { text: '🚨 BREAKING: Strait of Hormuz blocked — global oil panic erupts', sentiment: 'danger', nudge: { bias: 0.85, volMult: 5.0, frames: 170 } },
    { text: '🚨 FLASH: US strategic reserve release floods market — prices crash', sentiment: 'bearish', nudge: { bias: -0.70, volMult: 3.8, frames: 150 } },
    { text: '🚨 BREAKING: Saudi Arabia abandons OPEC+ deal — price war begins', sentiment: 'danger', nudge: { bias: -0.85, volMult: 5.0, frames: 160 } },
    { text: '🚨 FLASH: IEA declares peak oil demand reached — fossil fuel selloff', sentiment: 'bearish', nudge: { bias: -0.65, volMult: 3.5, frames: 145 } },
    { text: '🚨 BREAKING: Major oil producer nationalization — supply uncertainty spikes', sentiment: 'danger', nudge: { bias: 0.60, volMult: 4.5, frames: 150 } },
  ],
  spx: [
    { text: '🚨 BREAKING: Fed announces QE4 — \T stimulus floods equity markets', sentiment: 'bullish', nudge: { bias: 0.75, volMult: 3.8, frames: 165 } },
    { text: '🚨 FLASH: S&P 500 circuit breakers trip — trading halted for 15 minutes', sentiment: 'danger', nudge: { bias: -0.80, volMult: 5.5, frames: 160 } },
    { text: '🚨 BREAKING: Congress passes  T infrastructure bill — market surges', sentiment: 'bullish', nudge: { bias: 0.65, volMult: 3.2, frames: 150 } },
    { text: '🚨 FLASH: Index futures manipulation detected — SEC emergency order', sentiment: 'danger', nudge: { bias: -0.70, volMult: 4.5, frames: 155 } },
    { text: '🚨 BREAKING: S&P 500 earnings season: 90% beat — historic bull quarter', sentiment: 'bullish', nudge: { bias: 0.70, volMult: 3.5, frames: 155 } },
    { text: '🚨 FLASH: Presidential market emergency declared — index halted', sentiment: 'danger', nudge: { bias: -0.75, volMult: 5.0, frames: 160 } },
  ],
  pepe: [
    { text: '🚨 BREAKING: PEPE listed on every major exchange simultaneously — volume  B', sentiment: 'bullish', nudge: { bias: 0.95, volMult: 6.0, frames: 120 } },
    { text: '🚨 FLASH: Vitalik buys PEPE — DeFi community loses its mind', sentiment: 'bullish', nudge: { bias: 0.90, volMult: 5.5, frames: 115 } },
    { text: '🚨 BREAKING: PEPE becomes official currency of micronation — satirical or not?', sentiment: 'bullish', nudge: { bias: 0.85, volMult: 5.0, frames: 120 } },
    { text: '🚨 FLASH: PEPE dev wallet awakens — 50 trillion tokens incoming', sentiment: 'danger', nudge: { bias: -0.95, volMult: 7.0, frames: 130 } },
    { text: '🚨 BREAKING: Meme coin supercycle declared dead — PEPE nuked', sentiment: 'danger', nudge: { bias: -0.90, volMult: 6.5, frames: 125 } },
    { text: '🚨 FLASH: Elon calls PEPE a scam — exit liquidity event commences', sentiment: 'danger', nudge: { bias: -0.95, volMult: 7.0, frames: 120 } },
  ],
};

const FLASH_DISPLAY_FRAMES = 900;

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export class NewsTicker {
  public items: NewsItem[] = [];
  public activeNudge: ActiveNudge | null = null;
  public activeFlash: FlashNews | null = null;

  private frameCount = 0;
  private nextAmbientAt = 1200 + Math.floor(Math.random() * 600);
  private nextAssetNewsAt = 600 + Math.floor(Math.random() * 300);
  private nextFlashAt = 2400 + Math.floor(Math.random() * 1800);
  private lastEventType: string | null = null;
  private recentTexts: string[] = [];
  private maxItems = 6;

  /** Current asset id — set by MarketEngine or Game */
  public assetId: string = 'BTC';

  tick(currentEventType: EventType | null): void {
    this.frameCount++;

    // Tick active nudge
    if (this.activeNudge) {
      this.activeNudge.framesLeft--;
      if (this.activeNudge.framesLeft <= 0) this.activeNudge = null;
    }

    // Event-triggered news
    if (currentEventType && currentEventType !== this.lastEventType) {
      const pool = EVENT_NEWS[currentEventType];
      if (pool) this.pushNews({ text: pick(pool), sentiment: this.eventSentiment(currentEventType) });
    }
    this.lastEventType = currentEventType;

    // Ambient generic news
    if (this.frameCount >= this.nextAmbientAt) {
      const def = pick(AMBIENT_NEWS);
      this.pushNews({ text: def.text, sentiment: def.sentiment, nudge: def.nudge });
      if (def.nudge && !currentEventType) {
        this.activeNudge = { bias: def.nudge.bias, volMult: def.nudge.volMult, framesLeft: def.nudge.frames };
      }
      this.nextAmbientAt = this.frameCount + 1800 + Math.floor(Math.random() * 900);
    }

    // Asset-specific news
    if (this.frameCount >= this.nextAssetNewsAt) {
      const pool = ASSET_NEWS[this.assetId];
      if (pool) {
        const text = pick(pool);
        this.pushNews({ text, sentiment: 'neutral' });
      }
      this.nextAssetNewsAt = this.frameCount + 2400 + Math.floor(Math.random() * 1200);
    }

    // Flash news
    if (this.frameCount >= this.nextFlashAt && !this.activeFlash) {
      const assetPool = ASSET_FLASH_NEWS[this.assetId] ?? [];
      const pool = Math.random() < 0.65 && assetPool.length > 0 ? assetPool : FLASH_NEWS;
      const def = pick(pool);
      this.activeFlash = { text: def.text, sentiment: def.sentiment, displayFrames: FLASH_DISPLAY_FRAMES };
      this.activeNudge = { bias: def.nudge.bias, volMult: def.nudge.volMult, framesLeft: def.nudge.frames };
      this.pushNews({ text: def.text, sentiment: def.sentiment });
      this.nextFlashAt = this.frameCount + 2700 + Math.floor(Math.random() * 1800);
    }

    // Tick flash display
    if (this.activeFlash) {
      this.activeFlash.displayFrames--;
      if (this.activeFlash.displayFrames <= 0) this.activeFlash = null;
    }
  }

  private pushNews(item: NewsItem): void {
    if (this.recentTexts.includes(item.text)) return;
    this.items.push(item);
    this.recentTexts.push(item.text);
    if (this.recentTexts.length > 30) this.recentTexts.shift();
    if (this.items.length > this.maxItems) this.items.shift();
  }

  getNudgeBias(): number { return this.activeNudge?.bias ?? 0; }
  getNudgeVolMult(): number { return this.activeNudge?.volMult ?? 1; }

  private eventSentiment(type: EventType): 'bullish' | 'bearish' | 'neutral' | 'danger' {
    switch (type) {
      case 'pump': case 'whale_buy': case 'short_squeeze': case 'bull_trap': return 'bullish';
      case 'crash': case 'whale_sell': case 'dead_cat_bounce': return 'bearish';
      case 'flash_crash': return 'danger';
      default: return 'neutral';
    }
  }
}
