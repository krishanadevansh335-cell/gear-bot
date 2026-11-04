# Discord Gaming Community Verification Bot

Sequential, in-channel onboarding for a Discord gaming community. No unsolicited DMs. Uses a dedicated bot, JSON session persistence, a `/setup-verification` command, separate minor/adult channel areas, role assignment, moderator alerts, and inactivity timers.

## Setup
1. Use Node.js 22+.
2. In Discord Developer Portal create an application and bot. Enable **Server Members Intent** and **Message Content Intent** under Bot > Privileged Gateway Intents. Guilds and Guild Messages intents are also used.
3. Invite the bot with `bot` and `applications.commands` scopes. Grant View Channels, Send Messages, Read Message History, Manage Channels, Manage Roles, and Connect/Speak if needed. Do not grant Administrator. Put the bot role above roles it must assign.
4. Copy `.env.example` to `.env`, then set token and server ID. Optionally set `MOD_ROLE_ID` to the moderator role ID.
5. Run `npm install`, then `npm run check`, then `npm start`.
6. In the server run `/setup-verification` as an administrator. It creates the channel/role structure and attempts to hide existing channels from @everyone while allowing Verified. Review all existing permission overrides manually.
7. Test with a non-moderator test account before inviting members.

## Flow
- New member gets a welcome prompt in #verify and must reply `I agree`.
- Questions are asked one at a time. Age is numeric; gender and voice language can be skipped.
- Games must be one per line: `Apex Legends — PC — Intermediate` (platform PC/Console/Mobile; skill Beginner/Intermediate/Pro).
- Timing must include a time window and timezone; looking-for accepts Casual friends, Ranked squad, Chill VC, Co-op.
- Summary is confirmed with `yes`; `edit` restarts at age.
- Under 13 is stopped and flagged. Ages 13–17 receive Minor 13-17; 18+ receive Adult 18+. Game, timing, preference and optional gender roles are added, then Verified.
- Intro is posted without age number. User is directed to their age-group LFG channel.
- One reminder after 10 minutes; session is removed after 24 hours. No DMs are sent.

## Important limitations and review items
- Age is self-reported, not verified. The profile uses “confirmed” only.
- `edit` restarts the full questionnaire; field-by-field editing is not implemented.
- The age input rejects malformed values and flags ages above 100 for moderator review. The requested “ask once more for unrealistic age” is not fully implemented in this starter; moderators should handle flagged cases.
- Automated detection of contradictory ages in later messages is not implemented. Moderators can review reports and should use `/review-pending` for flagged sessions.
- Spam/link/mention heuristic flags for review; it is not a full anti-spam or safety classifier. Moderators must handle harassment, scams, sexual content, self-harm or danger reports promptly and compassionately. This code does not infer emergencies reliably.
- Minor and adult LFG/voice channels are separate. Do not create shared private-chat or cross-age voice spaces. Staff access is granted only if `MOD_ROLE_ID` is configured (or owner fallback for staff category).
- Discord permissions are additive across roles and channel overwrites. Audit every category/channel, especially pre-existing channels, threads, forum channels, bot integrations and invite permissions. This setup command is not a substitute for a permission audit.
- JSON persistence is suitable only for a small single-process bot. Back up `sessions.json`; for multi-instance/high-volume use SQLite/Postgres and a job queue.
- The code does not collect legal names, phone numbers, addresses, schools, IDs or photos. Do not ask for them in rules or moderation.

## Commands
- `/setup-verification` — create roles/channels and apply default visibility restrictions. Run once, review before running again (it may create duplicate categories).
- `/verification-status` — private status response.
- `/review-pending` — moderators list sessions flagged for review.

## Safety / production checklist
- Add clear server rules and a moderator response process before enabling invitations.
- Test with one adult test account and one minor test account; verify no cross-age visibility or voice access.
- Check that @everyone cannot view the rest of the server before Verified.
- Keep bot token out of prompts, Git and screenshots. Rotate it if exposed.
- Consider adding per-field editing, durable DB storage, audit logs, rate limiting, moderator case actions and age-contradiction reporting before production.
