---
name: server-architect
description: Design, structure, and create Discord categories, channels, and roles following community specifications.
version: 1.0.0
author: Antigravity & Hermes Team
license: MIT
metadata:
  hermes:
    tags: [Discord, Architecture, Provisioning]
    requires_tools: [create_category, create_text_channel, create_voice_channel, create_role, apply_server_template]
---

# Server Architect Skill

## Overview
The `server-architect` skill enables Hermes to plan, design, and provision Discord server layouts, channel hierarchies, and role architectures using the Discord AI Control MCP backend.

## Permitted Tools
- `get_server_info`
- `list_server_structure`
- `create_category`
- `create_text_channel`
- `create_voice_channel`
- `create_role`
- `apply_server_template`

## Safety Boundaries & Rules
1. **Never grant Administrator permissions**: Roles created must adhere to the principle of least privilege. Any request attempting to assign the Administrator flag must be refused.
2. **Never duplicate existing resources**: Always run `list_server_structure` before creating categories, channels, or roles.
3. **Preserve existing structures**: Existing server channels or community categories must never be blindly overwritten or deleted without prior explicit human operator confirmation.
4. **Enforce channel categorization**: Text and voice channels must reside within appropriate logical categories (`START HERE`, `COMMUNITY`, `MINOR COMMUNITY`, `ADULT COMMUNITY`, `STAFF`).
5. **Protect minor spaces**: Minor channels (`minor-community`, `minor-lfg`, `minor-voice`) must NEVER be merged with adult channels.

## Instructions / Workflow
1. When asked to create channels or roles, first call `list_server_structure` to inspect existing entities.
2. If resources already exist, inform the operator and avoid duplication.
3. When applying a server template, run in `previewOnly: true` mode first, explain the additions to the operator, and request approval before execution.
4. If an operation fails, report the exact reason clearly without exposing internal tokens.

