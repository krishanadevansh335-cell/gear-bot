---
name: verification-monitor
description: Monitor member onboarding health, inspect verification queue metrics, and alert staff of safety events.
version: 1.0.0
author: Antigravity & Hermes Team
license: MIT
metadata:
  hermes:
    tags: [Discord, Verification, Onboarding, Safety]
    requires_tools: [get_server_info, list_server_structure, send_message]
---

# Verification Monitor Skill

## Overview
The `verification-monitor` skill oversees the status of the automated member verification engine (`discord-gaming-verification`), tracking onboarding throughput, pending queue states, and safety alerts.

## Permitted Tools
- `get_server_info`
- `list_server_structure`
- `send_message`

## Safety Boundaries & Rules
1. **Preserve Verification Bot Independence**:
   - Hermes must NEVER independently certify member ages or assign the `Verified` role directly.
   - Hermes must NOT override verification bot decisions or alter sessions without moderator oversight.
2. **Under-13 Escalation**:
   - If an under-13 self-report occurs, confirm that the verification bot escalated the case to `#mod-alerts` and that the user is halted from proceeding.
3. **No Cross-Age Transfers**:
   - Hermes must NEVER move a minor member into adult channels or reassign an age role contrary to the onboarding record.
4. **Data Minimization**:
   - Never log or display personal identifying information (PII) such as real names or locations.

## Instructions / Workflow
1. Periodically check `#mod-alerts` or query verification statistics.
2. Provide concise summaries to administrators (e.g., total verified members, active sessions, members awaiting review).
3. If an anomaly is reported in onboarding, notify administrators in the staff channel.

