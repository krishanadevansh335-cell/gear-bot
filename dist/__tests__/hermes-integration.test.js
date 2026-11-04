import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HermesBridge } from "../hermes-bridge.js";
test("Hermes Skills frontmatter and markdown structure", () => {
    const skillsDir = path.resolve(process.cwd(), "hermes/skills");
    assert.ok(fs.existsSync(skillsDir), "hermes/skills directory must exist");
    const requiredSkills = [
        "server-architect",
        "community-manager",
        "permission-auditor",
        "verification-monitor",
        "server-maintenance"
    ];
    for (const skillName of requiredSkills) {
        const skillMdPath = path.join(skillsDir, skillName, "SKILL.md");
        assert.ok(fs.existsSync(skillMdPath), `SKILL.md for ${skillName} must exist`);
        const content = fs.readFileSync(skillMdPath, "utf-8");
        // Check YAML Frontmatter
        assert.ok(content.startsWith("---"), `${skillName} must have frontmatter`);
        assert.ok(content.includes(`name: ${skillName}`), `${skillName} name in frontmatter`);
        assert.ok(content.includes("description:"), `${skillName} description in frontmatter`);
        assert.ok(content.includes("Safety Boundaries"), `${skillName} must define Safety Boundaries`);
        assert.ok(content.includes("Permitted Tools"), `${skillName} must define Permitted Tools`);
    }
});
test("Hermes configuration yaml contains MCP and Discord bindings", () => {
    const configPath = path.resolve(process.cwd(), "hermes/config.yaml");
    assert.ok(fs.existsSync(configPath), "hermes/config.yaml must exist");
    const content = fs.readFileSync(configPath, "utf-8");
    assert.ok(content.includes("mcp_servers:"), "Config must declare mcp_servers");
    assert.ok(content.includes("discord-ai-control:"), "Config must bind discord-ai-control MCP");
    assert.ok(content.includes("require_mention: true"), "Config must enforce mention requirement");
    assert.ok(content.includes("allowed_users:"), "Config must include allowed_users mapping");
});
test("Hermes authorization filter logic rejects unauthorized users and outside channels", () => {
    const bridge = new HermesBridge({
        discordToken: "dummy",
        guildId: "924325170972340264",
        allowedUsers: ["111222333"],
        allowedRoles: ["role-admin-123"],
        allowedChannels: ["channel-staff-456"]
    });
    // Mock message from unauthorized user
    const mockMsgUnauthorized = {
        author: { id: "999888777", bot: false },
        guild: { id: "924325170972340264", ownerId: "00000000" },
        member: { roles: { cache: new Map() } },
        channel: { id: "channel-staff-456" },
        mentions: { has: () => true }
    };
    const authUnauth = bridge.isAuthorized(mockMsgUnauthorized);
    assert.equal(authUnauth.authorized, false);
    assert.equal(authUnauth.reason, "User not authorized");
    // Mock message from authorized user outside allowed channel without mention
    const mockMsgWrongChannel = {
        author: { id: "111222333", bot: false },
        guild: { id: "924325170972340264", ownerId: "00000000" },
        member: { roles: { cache: new Map() } },
        channel: { id: "general-public-chat" },
        mentions: { has: () => false }
    };
    const authWrongChannel = bridge.isAuthorized(mockMsgWrongChannel);
    assert.equal(authWrongChannel.authorized, false);
    assert.equal(authWrongChannel.reason, "Outside allowed channel and not mentioned");
    // Mock authorized message inside allowed channel
    const mockMsgValid = {
        author: { id: "111222333", bot: false },
        guild: { id: "924325170972340264", ownerId: "00000000" },
        member: { roles: { cache: new Map() } },
        channel: { id: "channel-staff-456" },
        mentions: { has: () => false }
    };
    const authValid = bridge.isAuthorized(mockMsgValid);
    assert.equal(authValid.authorized, true);
});
//# sourceMappingURL=hermes-integration.test.js.map