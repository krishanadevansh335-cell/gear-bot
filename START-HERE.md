# Discord Gaming Community Automation & AI Control

Unified Discord management and automated member onboarding system.

## 🚀 One-Command Operations

All services are orchestrated with single PowerShell scripts:

| Command | Action |
| :--- | :--- |
| `.\start-all.ps1` | **Starts the complete system**: installs dependencies, builds TypeScript, runs server provisioning, starts the verification bot and remote MCP server, and verifies process health. |
| `.\stop-all.ps1` | Gracefully terminates all background bot and server processes. |
| `.\setup-all.ps1` | Checks Node.js prerequisites, syncs `.env` files, installs packages, and compiles TypeScript. |
| `.\health-check.ps1` | Performs comprehensive health audits: credentials, bot connectivity, Discord permissions, active processes, and test suites. |

---

## 🏗️ Architecture & Server Structure

The server is automatically partitioned into isolated access tiers:

```
START HERE (Visible to everyone)
  ├── #verify       (Onboarding questions, agreements)
  └── #rules        (Read-only guidelines)

COMMUNITY (Visible to Verified members)
  ├── #introductions (Safe introduction cards)
  └── #ask-mods     (Assistance & inquiries)

MINOR COMMUNITY (Strict isolation: Minor 13-17 & Staff ONLY)
  ├── #minor-community
  ├── #minor-lfg
  └── Minor Voice

ADULT COMMUNITY (Strict isolation: Adult 18+ & Staff ONLY)
  ├── #adult-community
  ├── #adult-lfg
  └── Adult Voice

STAFF (Staff & Owner ONLY)
  └── #mod-alerts   (Under-13 escalation, suspicious message alerts)
```

---

## 🔒 Security & Onboarding Safeguards

1. **Zero Unsolicited DMs**: All verification occurs sequentially in `#verify`.
2. **Minor / Adult Separation**: Minor and Adult voice/text spaces are strictly mutually exclusive via Discord channel permission overwrites.
3. **Under-13 Escalation**: Users reporting age `< 13` are stopped immediately, locked from proceeding, and an alert is dispatched to `#mod-alerts`.
4. **No Privilege Escalation**: The bot backend automatically blocks and filters any attempt to create roles with `Administrator` rights.
5. **Session Persistence**: Member onboarding states persist across bot restarts.
6. **No Token Exposure**: Bot tokens and secrets are never logged or exposed in MCP tool responses.

---

## 🤖 AI Assistant Connections

### 1. Claude Desktop & Google Antigravity (Local STDIO MCP)
These connect locally via standard input/output (`dist/index.js`). They do not need background servers.

Add to `%APPDATA%\Claude\claude_desktop_config.json` or your Antigravity config:
```json
{
  "mcpServers": {
    "discord-ai-control": {
      "command": "node",
      "args": [
        "c:/Users/krisd/discord-ai-control/dist/index.js"
      ],
      "env": {
        "DISCORD_BOT_TOKEN": "your_bot_token_here",
        "DISCORD_GUILD_ID": "your_guild_id_here"
      }
    }
  }
}
```

### 2. ChatGPT (Remote Streamable HTTP / SSE)
- Automatically started on port 3000 by `.\start-all.ps1` when `MCP_AUTH_TOKEN` is set.
- Connect ChatGPT to `https://<your-domain>/sse` using Bearer authentication.

---

## ⚙️ Manual Discord Developer Portal Actions

The following settings cannot be configured programmatically and require one-time configuration in the [Discord Developer Portal](https://discord.com/developers/applications):

1. **Privileged Gateway Intents**:
   - Go to **Bot** -> **Privileged Gateway Intents**.
   - Enable **Server Members Intent** (detects new members).
   - Enable **Message Content Intent** (reads replies in `#verify`).
2. **Bot Permissions**:
   - Ensure the bot's role is positioned above the roles it manages (`Verified`, `Minor 13-17`, `Adult 18+`).

