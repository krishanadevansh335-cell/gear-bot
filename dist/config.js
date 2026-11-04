import dotenv from "dotenv";
dotenv.config();
export function loadConfig() {
    const discordToken = process.env.DISCORD_BOT_TOKEN || "";
    const guildId = process.env.DISCORD_GUILD_ID || "";
    const port = parseInt(process.env.PORT || "3000", 10);
    const mcpAuthToken = process.env.MCP_AUTH_TOKEN;
    return {
        discordToken,
        guildId,
        port,
        mcpAuthToken
    };
}
export function validateDiscordConfig(config) {
    if (!config.discordToken || config.discordToken.trim() === "" || config.discordToken.includes("your_bot_token_here")) {
        return {
            valid: false,
            error: "DISCORD_BOT_TOKEN is missing or using placeholder in .env. Please configure your Discord Bot Token."
        };
    }
    if (!config.guildId || config.guildId.trim() === "" || config.guildId.includes("your_guild_id_here")) {
        return {
            valid: false,
            error: "DISCORD_GUILD_ID is missing or using placeholder in .env. Please configure your Discord Guild ID."
        };
    }
    return { valid: true };
}
//# sourceMappingURL=config.js.map