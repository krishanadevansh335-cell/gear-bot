# Combined Architecture: Discord AI Control + Verification Engine

This document details how the **Discord AI Control (MCP Backend)** and the **Discord Gaming Community Verification Bot** integrate into one unified architecture.

---

## 1. System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Discord Guild (Server)                   │
                    │               ID: 924325170972340264                   │
                    └───────────▲────────────────────────────────▲───────────┘
                                │                                │
                      Channel/Role Management            Onboarding & Access Gate
                                │                                │
             ┌──────────────────┴───────────────┐  ┌─────────────┴─────────────────┐
             │    Discord AI Control (MCP)      │  │  Discord Gaming Verification  │
             │   (Admin & Management Plane)     │  │     (Member Data Plane)       │
             └───────────▲──────────────▲───────┘  └─────────────▲─────────────────┘
                         │              │                        │
                 Stdio / HTTP          HTTP / SSE         In-Channel Chat Events
                         │              │                 (#verify, #rules, intros)
           ┌─────────────┴──────┐ ┌─────┴──────────┐             │
           │ Claude / Antigravity│ │    ChatGPT    │      Incoming Members
           └────────────────────┘ └───────────────┘
```

---

## 2. Roles of the Two Services

### Service A: Discord AI Control (Admin & MCP Management Plane)
- **Path**: `c:\Users\krisd\discord-ai-control`
- **Operated by**: Claude Desktop, Antigravity, and ChatGPT.
- **Capabilities**:
  - Live inspection of channels, categories, permissions, and roles.
  - Applying server templates (`templates/gaming-server.json`).
  - Dynamic channel creation, renames, announcements, and permission hardening.
  - Safe modifications with guardrails (destructive confirmations, blocking automatic Administrator escalation).

### Service B: Discord Gaming Verification (Member Onboarding Data Plane)
- **Path**: `c:\Users\krisd\discord-ai-control\discord-gaming-verification`
- **Operated by**: Automated runtime responding to live member actions.
- **Capabilities**:
  - In-channel welcome in `#verify`.
  - Sequential 6-question questionnaire (Rules agreement, Age, Gender, Games & Skill, Timings & Timezones, Looking-for & Language).
  - Enforced minor/adult channel separation (`MINOR COMMUNITY` vs `ADULT COMMUNITY`).
  - Automated role assignment (`Minor 13-17`, `Adult 18+`, `Verified`, Game squads, Timing crews).
  - Inactivity reminders (10 min) and expiry (24 hr).
  - Suspicious text heuristics and moderator alerts.

---

## 3. Deployment Checklist

### Step 1: Enable Privileged Intents on Discord Developer Portal
Because Service B reads member responses in chat and handles member join events:
1. Open [Discord Developer Portal](https://discord.com/developers/applications).
2. Go to your Application -> **Bot** tab.
3. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**
4. Save Changes.

### Step 2: Running Both Services

#### Terminal 1 — Verification Bot (Member Onboarding)
```powershell
cd c:\Users\krisd\discord-ai-control\discord-gaming-verification
npm start
```
*Once running, an administrator executes `/setup-verification` inside your Discord server to build the categories and permission locks.*

#### Terminal 2 — AI MCP Management Backend (AI Assistant Control)
- **For Claude Desktop / Antigravity**:
  The AI client runs `dist/index.js` over stdio automatically according to your config.
- **For ChatGPT / Remote Access**:
  ```powershell
  cd c:\Users\krisd\discord-ai-control
  npm run start:http
  ```

---

## 4. Verification Workflow & Safeguards

```
[New Member Joins]
        │
        ▼
   Can ONLY view #verify and #rules (@everyone locked out of all other channels)
        │
        ▼
   Bot prompts welcome in #verify
        │
        ├─ Member replies: "I agree"
        ├─ Q1 (Age): Rejects <13 (alert mods), Flags >100
        ├─ Q2 (Gender): Optional (or skip)
        ├─ Q3 (Games): Format validation (Name — Platform — Skill)
        ├─ Q4 (Playtime & Timezone): Regex check for window & timezone
        ├─ Q5 (Looking For): Casual / Ranked / Chill / Co-op
        └─ Q6 (Voice Language): Optional (or skip)
        │
        ▼
   Summary & Confirmation: "yes" to confirm, "edit" to restart
        │
        ▼
   Roles Assigned:
   - Age Group: [Minor 13-17] OR [Adult 18+]
   - Status: [Verified]
   - Game Roles: [Apex Legends Squad], [Valorant Crew], etc.
   - Timing Roles: [Night Owls], [Weekend Warriors], etc.
        │
        ▼
   Permissions Granted:
   - Minor 13-17 -> Access ONLY to MINOR COMMUNITY (#minor-community, #minor-lfg, Minor Voice)
   - Adult 18+   -> Access ONLY to ADULT COMMUNITY (#adult-community, #adult-lfg, Adult Voice)
   - Verified    -> Access to general community channels (#introductions, #ask-mods)
```

