import { Client, GatewayIntentBits, Message, ChannelType } from "discord.js";
import { loadConfig } from "./config.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import * as path from "path";

// Hermes Environment Configuration
interface HermesConfig {
  discordToken: string;
  guildId: string;
  allowedUsers: string[];
  allowedRoles: string[];
  allowedChannels: string[];
}

function loadHermesConfig(): HermesConfig {
  const base = loadConfig();
  const discordToken = process.env.HERMES_DISCORD_TOKEN || "";
  const guildId = base.guildId;
  const allowedUsers = (process.env.HERMES_ALLOWED_USERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedRoles = (process.env.HERMES_ALLOWED_ROLES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedChannels = (process.env.HERMES_ADMIN_CHANNELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    discordToken,
    guildId,
    allowedUsers,
    allowedRoles,
    allowedChannels
  };
}

export class HermesBridge {
  private config: HermesConfig;
  private client: Client;
  private mcpClient: McpClient;
  private mcpTransport: StdioClientTransport | null = null;
  private isConnected: boolean = false;

  constructor(config: HermesConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.mcpClient = new McpClient(
      {
        name: "hermes-autonomous-admin",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );
  }

  public async start(): Promise<void> {
    if (!this.config.discordToken || this.config.discordToken.trim() === "") {
      console.log("[Hermes Bridge] HERMES_DISCORD_TOKEN is not set. Hermes autonomous bridge is in standby.");
      return;
    }

    console.log("[Hermes Bridge] Connecting to local MCP Server via stdio...");
    const mcpEntryPath = path.resolve(process.cwd(), "dist/index.js");
    this.mcpTransport = new StdioClientTransport({
      command: "node",
      args: [mcpEntryPath],
      env: {
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || "",
        DISCORD_GUILD_ID: this.config.guildId
      }
    });

    await this.mcpClient.connect(this.mcpTransport);
    console.log("[Hermes Bridge] MCP Client connected successfully.");

    // List discovered tools
    const toolsResult = await this.mcpClient.listTools();
    console.log(`[Hermes Bridge] Discovered ${toolsResult.tools.length} MCP tools: ${toolsResult.tools.map((t) => t.name).join(", ")}`);

    // Discord Event Handlers
    this.client.on("ready", () => {
      this.isConnected = true;
      console.log(`[Hermes Bridge] Hermes Autonomous Bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on("messageCreate", async (msg: Message) => {
      await this.handleMessage(msg);
    });

    await this.client.login(this.config.discordToken);
  }

  public isAuthorized(msg: Message): { authorized: boolean; reason?: string } {
    // 1. Never respond to bots (including self)
    if (msg.author.bot) return { authorized: false, reason: "Message from bot" };

    // 2. Guild scope restriction
    if (!msg.guild || msg.guild.id !== this.config.guildId) {
      return { authorized: false, reason: "Message outside configured guild" };
    }

    // 3. User allowlist check
    const userId = msg.author.id;
    let userAllowed = this.config.allowedUsers.length === 0 || this.config.allowedUsers.includes(userId);

    // 4. Role allowlist check
    let roleAllowed = false;
    const memberRoles = msg.member?.roles?.cache;
    if (this.config.allowedRoles.length > 0 && memberRoles) {
      if (typeof (memberRoles as any).some === "function") {
        roleAllowed = (memberRoles as any).some((r: any) => this.config.allowedRoles.includes(r.id || r));
      } else if (typeof (memberRoles as any).has === "function") {
        roleAllowed = this.config.allowedRoles.some((rId) => (memberRoles as any).has(rId));
      }
    }

    // Server owner is always authorized fallback
    if (msg.guild.ownerId === userId) {
      userAllowed = true;
    }

    if (!userAllowed && !roleAllowed) {
      return { authorized: false, reason: "User not authorized" };
    }

    // 5. Channel and Mention checks
    const isMentioned = this.client.user ? msg.mentions.has(this.client.user.id) : false;
    const isAllowedChannel = this.config.allowedChannels.length === 0 || this.config.allowedChannels.includes(msg.channel.id);

    if (!isAllowedChannel && !isMentioned) {
      return { authorized: false, reason: "Outside allowed channel and not mentioned" };
    }

    return { authorized: true };
  }

  private async handleMessage(msg: Message): Promise<void> {
    const auth = this.isAuthorized(msg);
    if (!auth.authorized) {
      return;
    }

    const content = msg.content.trim();
    // Parse basic commands or route to MCP tools
    if (content.toLowerCase().includes("ping")) {
      await msg.reply("🪽 Hermes Autonomous Administrator is online and listening.");
      return;
    }

    if (content.toLowerCase().includes("status") || content.toLowerCase().includes("server info")) {
      try {
        const info = await this.mcpClient.callTool({
          name: "get_server_info",
          arguments: {}
        });
        await msg.reply(`📊 **Server Status Report**\n\`\`\`json\n${JSON.stringify(info, null, 2).slice(0, 1800)}\n\`\`\``);
      } catch (err: any) {
        await msg.reply(`⚠️ Error fetching server status: ${err.message}`);
      }
      return;
    }

    if (content.toLowerCase().includes("audit permissions") || content.toLowerCase().includes("audit structure")) {
      try {
        const structure = await this.mcpClient.callTool({
          name: "list_server_structure",
          arguments: {}
        });
        await msg.reply(`🛡️ **Structure & Permission Audit**\n\`\`\`json\n${JSON.stringify(structure, null, 2).slice(0, 1800)}\n\`\`\``);
      } catch (err: any) {
        await msg.reply(`⚠️ Error auditing structure: ${err.message}`);
      }
      return;
    }
  }

  public async stop(): Promise<void> {
    if (this.mcpTransport) {
      await this.mcpTransport.close();
    }
    this.client.destroy();
    this.isConnected = false;
  }
}

// CLI Launcher
async function main() {
  const config = loadHermesConfig();
  const bridge = new HermesBridge(config);
  await bridge.start();
}

if (process.argv[1] && process.argv[1].includes("hermes-bridge")) {
  main().catch((err) => {
    console.error("[Hermes Bridge] Fatal Error:", err);
    process.exit(1);
  });
}
