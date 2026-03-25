# Market Casino Tycoon

Un jeu de trading simulé dans le navigateur, style tycoon/roguelite. Tu gères un portefeuille, tu trades des actifs financiers en temps réel simulé, tu recrutes des bots, tu débloques des upgrades et tu tentes de ne pas te faire liquider.

## Concept

Le marché tourne en continu (1 frame = 1 minute de temps simulé). Tu peux ouvrir des positions Long ou Short avec effet de levier sur différents actifs. Si ton portefeuille tombe à zéro, c'est la liquidation — game over.

L'objectif : accumuler assez de capital pour **prestige** (recommencer avec des bonus permanents) et débloquer les actifs les plus volatils.

## Actifs disponibles

| Actif | Symbole | Difficulté | Levier max | Débloqué au prestige |
|---|---|---|---|---|
| S&P 500 | SPX | ⭐ | x3 | 0 (départ) |
| Gold | Gold | ⭐ | x5 | 1 |
| Bitcoin | BTC | ⭐⭐ | x15 | 2 |
| Oil | Oil | ⭐⭐ | x20 | 3 |
| Ethereum | ETH | ⭐⭐⭐ | x25 | 4 |
| Solana | SOL | ⭐⭐⭐⭐ | x30 | 5 |
| Dogecoin | DOGE | ⭐⭐⭐⭐⭐ | x35 | 6 |
| Pepe | PEPE | ⭐⭐⭐⭐⭐ | x45 | 8 |

## Systèmes de jeu

- **Trading manuel** — Long/Short avec levier réglable, gestion du risque de liquidation
- **Bots** — achat de bots automatisés qui tradent en background et génèrent des revenus passifs
- **Upgrades (roguelite)** — à chaque rang atteint, choix d'un upgrade parmi plusieurs (boost de profit, réduction de liquidation, vitesse des bots, etc.)
- **Événements marché** — news et événements aléatoires qui font bouger les prix (krach, rally, FUD, FOMO...)
- **Daily Missions** — objectifs quotidiens pour des bonus
- **Prestige** — réinitialise la partie avec des bonus permanents et débloque de nouveaux actifs
- **Leaderboard** — classement des joueurs via un serveur Node.js
- **Sauvegarde automatique** — progression sauvegardée dans le localStorage

## Stack technique

- **Frontend** : TypeScript, Canvas 2D (rendu custom sans framework)
- **Bundler** : Vite
- **Backend** : Node.js (serveur Express pour le leaderboard et la persistance des données)

## Lancer le projet

```bash
npm install

# Développement
npm run dev

# Build production
npm run build
```

Le serveur backend se lance séparément depuis le dossier `server/` :

```bash
node server/index.js
```
