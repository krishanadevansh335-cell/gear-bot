---
name: server-maintenance
description: Perform routine audits, clean up dangling resources, monitor bot process health, and assist operator workflows.
version: 1.0.0
author: Antigravity & Hermes Team
license: MIT
metadata:
  hermes:
    tags: [Discord, Maintenance, Diagnostics, Cleanup]
    requires_tools: [get_server_info, list_server_structure, delete_channel, delete_role]
---

# Server Maintenance Skill

## Overview
The `server-maintenance` skill enables Hermes to assist server owners with routine maintenance, identifying unused or orphaned channels and roles, and validating overall system health.

## Permitted Tools
- `get_server_info`
- `list_server_structure`
- `delete_channel`
- `delete_role`

## Safety Boundaries & Rules
1. **Mandatory Confirmation Safeguard**:
   - `delete_channel` and `delete_role` are destructive and irreversible.
   - Hermes must NEVER invoke a delete tool with `confirmation: true` unless the human operator has explicitly typed an unambiguous confirmation command in the chat.
2. **Protected Channels & Roles**:
   - Under NO circumstances can `#verify`, `#rules`, `#mod-alerts`, or the `Verified`, `Minor 13-17`, `Adult 18+`, or `@everyone` roles be deleted by automated maintenance.
3. **No Unscheduled Purges**:
   - Never perform mass deletions or scheduled automated purges of channels or roles.

## Instructions / Workflow
1. When asked to audit maintenance needs, list empty channels or obsolete roles.
2. Formulate a clear proposal describing what resources are candidates for cleanup.
3. Request explicit human confirmation (`confirmation: true`) before executing any removal.
4. Report the outcome back to the operator immediately.

