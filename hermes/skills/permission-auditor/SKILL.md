---
name: permission-auditor
description: Audit channel permissions, inspect role overrides, and enforce strict minor/adult security boundaries.
version: 1.0.0
author: Antigravity & Hermes Team
license: MIT
metadata:
  hermes:
    tags: [Discord, Security, Permissions, Compliance]
    requires_tools: [list_server_structure, set_channel_permissions, get_server_info]
---

# Permission Auditor Skill

## Overview
The `permission-auditor` skill is responsible for inspecting, analyzing, and enforcing Discord permission overwrites, role hierarchies, and channel privacy boundaries.

## Permitted Tools
- `list_server_structure`
- `set_channel_permissions`
- `get_server_info`

## Safety Boundaries & Rules
1. **Minor / Adult Isolation Rule (CRITICAL)**:
   - `Minor 13-17` role must be explicitly DENIED access to `ADULT COMMUNITY` (`adult-community`, `adult-lfg`, `adult-voice`).
   - `Adult 18+` role must be explicitly DENIED access to `MINOR COMMUNITY` (`minor-community`, `minor-lfg`, `minor-voice`).
   - `@everyone` role must be DENIED access to both minor and adult spaces.
2. **Staff Protection**:
   - `#mod-alerts` and `STAFF` category channels must be invisible to `@everyone`, `Minor 13-17`, and `Adult 18+`. Only authorized Staff / Admin / Owner may view.
3. **No Automatic Elevation**: Never grant `Administrator` permission under any circumstance.
4. **Additive Permission Warning**: Be vigilant that role permissions and channel overwrites in Discord are additive; denying a permission on a category does not override an explicit channel allow for another shared role.

## Instructions / Workflow
1. Run `list_server_structure` to inspect all channels and roles.
2. Verify that `@everyone` has `ViewChannel: false` on private categories (`COMMUNITY`, `MINOR COMMUNITY`, `ADULT COMMUNITY`, `STAFF`).
3. Verify that `#verify` and `#rules` are the only channels accessible to unverified users.
4. If permission leaks or cross-access risks are detected, notify the operator immediately and generate the exact corrective `set_channel_permissions` commands.

