import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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
            console.log(`[Discord AI Control] Connected to Discord bot successfully.`);
        }
        else {
            console.warn(`[Discord AI Control] Warning: DISCORD_BOT_TOKEN not configured or using default placeholders.`);
        }
    }
    catch (err) {
        console.warn(`[Discord AI Control] Notice: Discord bot connection deferred or failed: ${err.message}`);
    }
    const app = express();
    const server = createMcpServer(discordService);
    // Active transports by session ID
    const transports = new Map();
    // Authentication Middleware
    const authMiddleware = (req, res, next) => {
        // If an MCP_AUTH_TOKEN is configured, require Bearer token
        if (config.mcpAuthToken && config.mcpAuthToken.trim() !== "") {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header." });
                return;
            }
            const token = authHeader.split(" ")[1];
            if (token !== config.mcpAuthToken) {
                res.status(403).json({ error: "Forbidden: Invalid authentication token." });
                return;
            }
        }
        next();
    };
    // Healthcheck endpoint
    app.get("/health", (req, res) => {
        res.json({
            status: "ok",
            botConnected: discordService.isClientReady(),
            time: new Date().toISOString()
        });
    });
    // Server-Sent Events endpoint for MCP streamable connection (ChatGPT / Remote MCP)
    app.get("/sse", authMiddleware, async (req, res) => {
        console.log("[Remote MCP] Incoming SSE connection request...");
        const transport = new SSEServerTransport("/messages", res);
        const sessionId = transport.sessionId;
        transports.set(sessionId, transport);
        transport.onclose = () => {
            console.log(`[Remote MCP] SSE transport closed for session: ${sessionId}`);
            transports.delete(sessionId);
        };
        await server.connect(transport);
    });
    // JSON-RPC message receiver endpoint for SSE clients
    app.post("/messages", authMiddleware, express.json(), async (req, res) => {
        const sessionId = req.query.sessionId;
        if (!sessionId) {
            res.status(400).send("Missing sessionId query parameter");
            return;
        }
        const transport = transports.get(sessionId);
        if (!transport) {
            res.status(404).send(`Transport session not found for session ID: ${sessionId}`);
            return;
        }
        await transport.handlePostMessage(req, res);
    });
    const port = config.port;
    app.listen(port, () => {
        console.log(`[Discord AI Control] Remote MCP HTTP/SSE Server running on port ${port}`);
        console.log(`[Discord AI Control] SSE Endpoint: http://localhost:${port}/sse`);
        console.log(`[Discord AI Control] Healthcheck: http://localhost:${port}/health`);
        if (config.mcpAuthToken) {
            console.log(`[Discord AI Control] Authentication enabled (Bearer token check active).`);
        }
        else {
            console.warn(`[Discord AI Control] Caution: MCP_AUTH_TOKEN is not set. All endpoints are open.`);
        }
    });
}
main().catch((err) => {
    console.error(`[Discord AI Control] Fatal error starting HTTP server:`, err);
    process.exit(1);
});
//# sourceMappingURL=http-server.js.map