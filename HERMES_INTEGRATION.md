# Hermes Autonomous Discord Administrator Integration

This document describes the autonomous Discord administration system powered by **Hermes Agent** and the shared **Discord AI Control (MCP Backend)**.

---

## 1. System Architecture

```
                                  ┌─────────────────────────┐
                                  │     Discord Server      │
                                  │ ID: 924325170972340264  │
                                  └────────────▲────────────┘
                                               │
               ┌───────────────────────────────┼───────────────────────────────┐
               │                               │                               │
        Management Plane             Autonomous Admin Plane            Onboarding Plane
               │                               │                               │
    ┌──────────┴──────────┐       ┌────────────┴─────────────┐    ┌────────────┴────────────┐
    │  Discord AI Control │       │   Hermes Agent Bridge    │    │ Gaming Verification Bot │
    │     (MCP Server)    │◄──────┤   (Dedicated Bot User)   │    │  (Runs #verify flows)   │
    └──────────▲──────────┘ stdio └──────────────────────────┘    └─────────────────────────┘
               │
    ┌──────────┴──────────┐
    │  Client Assistants  │
    │  - Claude Desktop   │
    │  - Antigravity      │
    │  - ChatGPT (SSE)    │
    └─────────────────────┘
```

---

## 2. Security Boundaries & Authorization

Hermes operates as an autonomous agent under strict security guardrails:

1. **Dedicated Bot Identity**: Uses its own independent token (`HERMES_DISCORD_TOKEN`), separate from the management bot and onboarding bot.
2. **Access Control (Allowlists)**:
   - Evaluates incoming message authors against `HERMES_ALLOWED_USERS`.
   - Evaluates roles against `HERMES_ALLOWED_ROLES`.
   - Ignores messages from unauthorized users, other bots, and messages outside `HERMES_ADMIN_CHANNELS` (unless explicitly mentioned).
3. **No Automatic Elevation**: Under no circumstance can Hermes grant or create roles with `Administrator` rights.
4. **Member Verification Invariance**:
   - Hermes **CANNOT** independently certify age.
   - Hermes **CANNOT** assign the `Verified` role directly.
   - Hermes **CANNOT** transfer members between minor and adult spaces. Member onboarding is strictly isolated inside `discord-gaming-verification`.
5. **Human Approval Safeguard**: Destructive actions (`delete_channel`, `delete_role`) require explicit, typed operator confirmation (`confirmation: true`).

---

## 3. The 5 Administrative Skills

The Hermes skills reside in [`hermes/skills/`](file:///c:/Users/krisd/discord-ai-control/hermes/skills):

| Skill Name | SKILL.md Location | Permitted Tools | Core Safety Boundary |
| :--- | :--- | :--- | :--- |
| **`server-architect`** | `hermes/skills/server-architect/SKILL.md` | `create_category`, `create_text_channel`, `create_voice_channel`, `create_role`, `apply_server_template` | No duplicate creation; no Administrator roles; preserves existing structures. |
| **`community-manager`** | `hermes/skills/community-manager/SKILL.md` | `send_message`, `rename_channel`, `get_server_info` | Zero unsolicited DMs; no mass `@everyone` without permission; no public accusations. |
| **`permission-auditor`**| `hermes/skills/permission-auditor/SKILL.md`| `list_server_structure`, `set_channel_permissions` | Enforces strict isolation: Minors blocked from adult spaces; Adults blocked from minor spaces. |
| **`verification-monitor`**| `hermes/skills/verification-monitor/SKILL.md`| `get_server_info`, `list_server_structure`, `send_message` | Read-only verification analytics; alerts staff in `#mod-alerts`; never overrides verification logic. |
| **`server-maintenance`**| `hermes/skills/server-maintenance/SKILL.md`| `delete_channel`, `delete_role`, `get_server_info` | Destructive operations require explicit confirmation; protected channels (`#verify`, `#rules`, `#mod-alerts`) cannot be deleted. |

---

## 4. Configuration Location & Environment Setup

### A. Environment Configuration (`.env`)
```env
# Discord Management Bot (Shared MCP & Provisioner)
DISCORD_BOT_TOKEN=MTU2Njg0MDgxMDg1MzM3NjMwMg...
DISCORD_GUILD_ID=924325170972340264

# Hermes Autonomous Administrator Bot
HERMES_DISCORD_TOKEN=your_dedicated_hermes_bot_token_here
HERMES_ALLOWED_USERS=your_discord_user_id_here
HERMES_ALLOWED_ROLES=
HERMES_ADMIN_CHANNELS=

# Remote MCP HTTP / SSE Server (for ChatGPT)
PORT=3000
MCP_AUTH_TOKEN=mcp_sec_token_924325170972340264
```

### B. Hermes Config File (`hermes/config.yaml`)
Located at [`hermes/config.yaml`](file:///c:/Users/krisd/discord-ai-control/hermes/config.yaml), pointing directly to the local stdio MCP server (`dist/index.js`) and skills directory.

---

## 5. Operations & Script Reference

From PowerShell in `c:\Users\krisd\discord-ai-control`:

```powershell
# 1. Back up all configuration, skills, templates, and state
.\BACKUP.ps1

# 2. Start the entire system (Verification Bot, Server Provisioning, Remote MCP, Hermes Bridge)
.\start-all.ps1

# 3. Check health and process status across all components
.\health-check.ps1

# 4. Stop all background services cleanly
.\stop-all.ps1
```

