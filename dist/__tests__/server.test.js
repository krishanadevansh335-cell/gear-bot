import test from "node:test";
import assert from "node:assert/strict";
import { validateDiscordConfig } from "../config.js";
import { DiscordService } from "../discord-service.js";
import { createMcpServer } from "../mcp-server.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
test("Config validation catches empty and placeholder tokens", () => {
    const invalidConfig1 = {
        discordToken: "",
        guildId: "123456789",
        port: 3000
    };
    assert.equal(validateDiscordConfig(invalidConfig1).valid, false);
    const invalidConfig2 = {
        discordToken: "your_bot_token_here",
        guildId: "123456789",
        port: 3000
    };
    assert.equal(validateDiscordConfig(invalidConfig2).valid, false);
    const validConfig = {
        discordToken: "valid_secret_token_1234567890",
        guildId: "987654321012345678",
        port: 3000
    };
    assert.equal(validateDiscordConfig(validConfig).valid, true);
});
test("MCP Server registers all 12 required tools", async () => {
    const mockConfig = {
        discordToken: "dummy",
        guildId: "dummy",
        port: 3000
    };
    const discordService = new DiscordService(mockConfig);
    const server = createMcpServer(discordService);
    const expectedTools = [
        "get_server_info",
        "list_server_structure",
        "create_category",
        "create_text_channel",
        "create_voice_channel",
        "create_role",
        "set_channel_permissions",
        "send_message",
        "rename_channel",
        "delete_channel",
        "delete_role",
        "apply_server_template"
    ];
    // Verify tools list through MCP handler
    const handler = server._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    assert.ok(handler, "Tools list request handler exists");
    const response = await handler({ method: "tools/list", params: {} });
    assert.ok(response && response.tools, "Tools response contains tools list");
    const toolNames = response.tools.map((t) => t.name);
    for (const expected of expectedTools) {
        assert.ok(toolNames.includes(expected), `Missing required MCP tool: ${expected}`);
    }
    assert.equal(toolNames.length, 12, "Exactly 12 MCP tools should be registered");
});
test("Destructive operations require explicit confirmation", async () => {
    const mockConfig = {
        discordToken: "dummy",
        guildId: "dummy",
        port: 3000
    };
    const discordService = new DiscordService(mockConfig);
    const server = createMcpServer(discordService);
    const callToolHandler = server._requestHandlers.get(CallToolRequestSchema.shape.method.value);
    // Attempt delete_channel without confirmation
    const res = await callToolHandler({
        method: "tools/call",
        params: {
            name: "delete_channel",
            arguments: {
                channelId: "123456",
                confirmation: false
            }
        }
    });
    assert.ok(res.content[0].text.includes("Destructive operation prevented"));
});
test("Server template schema and gaming-server.json validity", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const templatePath = path.resolve(process.cwd(), "templates/gaming-server.json");
    assert.ok(fs.existsSync(templatePath), "templates/gaming-server.json must exist");
    const content = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
    assert.ok(Array.isArray(content.roles), "roles must be an array");
    assert.ok(Array.isArray(content.categories), "categories must be an array");
    assert.ok(content.roles.some((r) => r.name === "Admin"), "Admin role should exist");
    assert.ok(content.categories.some((c) => c.name === "START HERE"), "START HERE category should exist");
});
//# sourceMappingURL=server.test.js.map