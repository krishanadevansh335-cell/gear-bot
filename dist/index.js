#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { DiscordService } from "./discord-service.js";
import { createMcpServer } from "./mcp-server.js";
async function main() {
    const config = loadConfig();
    const discordService = new DiscordService(config);
    // Attempt Discord connection
    try {
        if (config.discordToken && !config.discordToken.includes("your_bot_token")) {
            await discordService.connect();
            // Write log to stderr so stdio JSON-RPC isn't corrupted
            process.stderr.write(`[Discord AI Control] Connected to Discord bot successfully.\n`);
        }
        else {
            process.stderr.write(`[Discord AI Control] Warning: DISCORD_BOT_TOKEN not configured or using default placeholders.\n`);
        }
    }
    catch (err) {
        process.stderr.write(`[Discord AI Control] Notice: Discord bot connection deferred or failed: ${err.message}\n`);
    }
    const server = createMcpServer(discordService);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`[Discord AI Control] MCP Stdio server started and listening.\n`);
}
main().catch((err) => {
    process.stderr.write(`[Discord AI Control] Fatal error: ${err.message}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map