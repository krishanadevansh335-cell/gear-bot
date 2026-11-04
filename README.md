# 🎮 Gamer Gear (`gear-bot`)

> **The All-in-One Discord Gaming Community Platform**  
> Integrated with Discord Native Onboarding, Age Classification, Verification Walls, Dynamic Game Squads, and Gamer Profile Progression.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.17+-blue.svg)](https://discord.js.org/)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

---

## 🌟 Key Features

1. **Native Onboarding Integration**
   - Seamlessly integrates with Discord's **3 Native Onboarding Questions**:
     - *Question 1 (Games)*: 12 Popular titles (Apex, Valorant, Minecraft, Palworld, Helldivers 2, etc.)
     - *Question 2 (Platform)*: PC, PlayStation, Xbox, Mobile, Nintendo Switch
     - *Question 3 (Experience)*: Competitive, Casual, Co-op, Survival, RPG, Horror, Social gaming
   - Members answering in Discord have their preferences automatically detected and synced.
   - Members joining without native prompts are guided through the exact same 3 questions inside Game Gear.

2. **Airtight Verification Wall & Age Separation**
   - Main community channels (`COMMUNICATION`, `JUST-FUN`, voice channels, etc.) remain strictly locked until verification completes.
   - Separates members into **18+ Member** and **Teen Member (13–17)** with dedicated discussion and matchmaking channels.
   - Privacy-first: Raw numerical age and gender are private and **never** revealed publicly in announcements or cards.

3. **Gamer Profiles & Progression (Phase 2)**
   - XP leveling formula, reputation tracking, and unlockable achievement badges.
   - Canvas-rendered dynamic welcome, departure, profile, and tournament match cards.

4. **Dynamic Multiplayer Squads & LFG Matchmaking**
   - Dynamic game channel provisioning and squad role assignments.
   - Interactive role toggles and LFG squad pings.

5. **Timeout-Proof Discord Interaction Handling**
   - Built with immediate deferrals (`deferReply`, `deferUpdate`) to eliminate Discord's 3-second `didn't respond in time` timeouts.
   - Graceful token expiration handling (`10062 Unknown Interaction`) and double-click prevention.

---

## 🚀 24/7 Cloud Hosting Guide

You can host Gamer Gear 24/7 on platforms like **Bot-Hosting.net**, **Railway**, or **Render** so the bot stays online when your computer is off.

### Option 1: Bot-Hosting.net (Recommended for Discord Bots)

1. **Fork or push this repository** to your GitHub account (e.g. `https://github.com/krishanadevansh335-cell/gear-bot`).
2. Log in to [Bot-Hosting.net](https://bot-hosting.net/) using your Discord or GitHub account.
3. Click **Create Bot** / **Deploy from GitHub**.
4. Select your `gear-bot` repository.
5. Set the configuration:
   - **Runtime**: `Node.js 22` (or latest LTS)
   - **Main Script / Start Command**: `npm start`
6. Add **Environment Variables**:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `DISCORD_BOT_TOKEN` | `your_bot_token` | Discord bot token from Developer Portal |
   | `DISCORD_GUILD_ID` | `924325170972340264` | Target Discord server ID |
   | `MOD_ROLE_ID` | *(optional)* | Role ID for moderator verification alerts |
7. Click **Deploy**. Gamer Gear will install dependencies, build TypeScript modules, and connect to Discord.

---

### Option 2: Railway

1. Open [Railway.app](https://railway.app/) and create a **New Project -> Deploy from GitHub repo**.
2. Select `gear-bot`.
3. In **Variables**, add `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID`.
4. Railway will automatically detect `package.json`, run `npm run build` via `prestart`, and launch the bot via `npm start`.

---

## 💻 Local Development & Self-Hosting

### 1. Prerequisites
- **Node.js**: v22.0.0 or higher
- **NPM**: v10.0.0 or higher

### 2. Installation
```powershell
# Clone the repository
git clone https://github.com/krishanadevansh335-cell/gear-bot.git
cd gear-bot

# Install dependencies
npm install

# Build TypeScript source
npm run build
```

### 3. Environment Setup
Create a `.env` file from `.env.example`:
```powershell
Copy-Item .env.example .env
```
Fill in your credentials:
```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here
MOD_ROLE_ID=
```

### 4. Running the Bot
```powershell
# Starts the Gamer Gear Discord Bot
npm start

# Run test suite (86 tests)
npm test
```

---

## 🔒 Security Best Practices

- **Never commit `.env` or bot tokens**: All `.env` files and SQLite databases (`*.db`) are strictly excluded in `.gitignore`.
- **Fail-Closed Permissions**: Main channels deny `ViewChannel` to `@everyone` by default, unlocking only upon receiving `@Verified Member`.
- **Privacy Enforcement**: Introduction cards and status embeds strictly omit private attributes such as raw age and private gender.

---

## 📜 License
MIT License. Free to use and customize for your Discord gaming community.
