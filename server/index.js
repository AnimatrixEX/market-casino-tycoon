// MCT API Server — leaderboard stored in data.json
// Runs on 127.0.0.1:8765, proxied by nginx at /api/

const http = require('http');
const fs   = require('fs');
const path = require('path');

const DATA_FILE    = path.join(__dirname, 'data.json');
const PORT         = 8765;
const HOST         = '127.0.0.1';
const MAX_ENTRIES  = 20;
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN || 'changeme';

// ---- Feed (in-memory, ephemeral) ----

const feedEvents = [];   // { id, name, type, amount, ts }
let   feedNextId = 1;
const FEED_MAX_AGE_MS      = 60_000;
const FEED_MAX_STORE       = 200;
const FEED_MAX_PER_GET     = 20;    // events returned per poll
const FEED_BODY_LIMIT      = 256;   // bytes
// Per-player rate-limit: one POST per 10s
const FEED_PLAYER_COOLDOWN = 10_000;
const feedRateMap = new Map(); // name -> ts
// Global rate-limit: max 30 POSTs per 10s across all clients
const FEED_GLOBAL_MAX      = 30;
const FEED_GLOBAL_WINDOW   = 10_000;
const feedGlobalTs         = []; // sliding window of timestamps

function feedPrune() {
  const cutoff = Date.now() - FEED_MAX_AGE_MS;
  while (feedEvents.length && feedEvents[0].ts < cutoff) feedEvents.shift();
  // Also prune rate map entries older than the player cooldown to avoid memory leak
  const rateCutoff = Date.now() - FEED_PLAYER_COOLDOWN * 6;
  for (const [k, ts] of feedRateMap) {
    if (ts < rateCutoff) feedRateMap.delete(k);
  }
}

function feedGlobalAllowed() {
  const now = Date.now();
  const cutoff = now - FEED_GLOBAL_WINDOW;
  while (feedGlobalTs.length && feedGlobalTs[0] < cutoff) feedGlobalTs.shift();
  if (feedGlobalTs.length >= FEED_GLOBAL_MAX) return false;
  feedGlobalTs.push(now);
  return true;
}

function sanitizeFeedName(raw) {
  return String(raw ?? '').trim().slice(0, 20) || 'Anonymous';
}

// ---- Storage ----

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function persist(entries) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries));
}

function addEntry(entries, entry) {
  // Keep only the best entry per player name (case-insensitive)
  const key = entry.name.toLowerCase();
  const existing = entries.findIndex(e => e.name.toLowerCase() === key);
  if (existing !== -1) {
    const prev = entries[existing];
    // Replace only if new entry is strictly better
    if (
      entry.prestige > prev.prestige ||
      (entry.prestige === prev.prestige && entry.balance > prev.balance)
    ) {
      entries[existing] = entry;
    }
  } else {
    entries.push(entry);
  }
  entries.sort((a, b) =>
    b.prestige !== a.prestige ? b.prestige - a.prestige : b.balance - a.balance
  );
  return entries.slice(0, MAX_ENTRIES);
}

function sanitizeName(raw) {
  const s = String(raw ?? '').trim().slice(0, 20);
  return s || 'Anonymous';
}

// ---- Server ----

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'HEAD') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  // ---- /api/feed ----
  if (url === '/api/feed') {
    if (req.method === 'GET') {
      feedPrune();
      const afterParam = new URLSearchParams(req.url.split('?')[1] || '').get('after');
      const afterId = afterParam ? parseInt(afterParam, 10) : 0;
      // Cap response to FEED_MAX_PER_GET most recent events
      const events = feedEvents.filter(e => e.id > afterId).slice(-FEED_MAX_PER_GET);
      res.writeHead(200);
      res.end(JSON.stringify(events));

    } else if (req.method === 'POST') {
      // Global rate-limit check before reading body
      if (!feedGlobalAllowed()) {
        res.writeHead(503);
        res.end('{"error":"server busy"}');
        return;
      }

      let body = '';
      let tooBig = false;
      req.on('data', chunk => {
        body += chunk;
        if (body.length > FEED_BODY_LIMIT) {
          tooBig = true;
          res.writeHead(413);
          res.end('{"error":"payload too large"}');
          req.destroy();
        }
      });
      req.on('end', () => {
        if (tooBig) return;
        try {
          const raw = JSON.parse(body);
          const name = sanitizeFeedName(raw.name);
          const type = raw.type === 'liquidation' ? 'liquidation' : 'profit';
          const amount = type === 'profit' ? Math.max(0, Number(raw.amount) || 0) : 0;

          // Per-player rate-limit
          const now = Date.now();
          const lastPost = feedRateMap.get(name.toLowerCase()) || 0;
          if (now - lastPost < FEED_PLAYER_COOLDOWN) {
            res.writeHead(429);
            res.end('{"error":"rate limited"}');
            return;
          }
          feedRateMap.set(name.toLowerCase(), now);

          feedEvents.push({ id: feedNextId++, name, type, amount, ts: now });
          if (feedEvents.length > FEED_MAX_STORE) feedEvents.shift();

          res.writeHead(200);
          res.end('{"ok":true}');
        } catch {
          res.writeHead(400);
          res.end('{"error":"bad request"}');
        }
      });

    } else {
      res.writeHead(405);
      res.end('{"error":"method not allowed"}');
    }
    return;
  }

  if (url !== '/api/leaderboard') {
    res.writeHead(404);
    res.end('{"error":"not found"}');
    return;
  }

  if (req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(load()));

  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const raw = JSON.parse(body);
        if (typeof raw.balance !== 'number' || typeof raw.prestige !== 'number') {
          res.writeHead(400);
          res.end('{"error":"invalid payload"}');
          return;
        }
        const entry = {
          name:     sanitizeName(raw.name),
          balance:  Number(raw.balance),
          prestige: Math.floor(Number(raw.prestige)),
          title:    String(raw.title ?? '').slice(0, 64),
          date:     Date.now(),
        };
        const updated = addEntry(load(), entry);
        persist(updated);
        res.writeHead(200);
        res.end(JSON.stringify(updated));
      } catch {
        res.writeHead(400);
        res.end('{"error":"bad request"}');
      }
    });

  } else if (req.method === 'DELETE') {
    const token = req.headers['x-admin-token'];
    const playerName = req.headers['x-player-name'];

    if (token === ADMIN_TOKEN) {
      // Admin: clear all
      persist([]);
      res.writeHead(200);
      res.end('[]');
    } else if (playerName) {
      // Player: remove own entry
      const key = String(playerName).toLowerCase();
      const entries = load().filter(e => e.name.toLowerCase() !== key);
      persist(entries);
      res.writeHead(200);
      res.end(JSON.stringify(entries));
    } else {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
    }

  } else {
    res.writeHead(405);
    res.end('{"error":"method not allowed"}');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MCT API listening on ${HOST}:${PORT}`);
});

process.on('uncaughtException', err => console.error('Uncaught:', err));
