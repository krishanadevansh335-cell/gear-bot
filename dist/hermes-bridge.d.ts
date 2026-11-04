import { Message } from "discord.js";
interface HermesConfig {
    discordToken: string;
    guildId: string;
    allowedUsers: string[];
    allowedRoles: string[];
    allowedChannels: string[];
}
export declare class HermesBridge {
    private config;
    private client;
    private mcpClient;
    private mcpTransport;
    private isConnected;
    constructor(config: HermesConfig);
    start(): Promise<void>;
    isAuthorized(msg: Message): {
        authorized: boolean;
        reason?: string;
    };
    private handleMessage;
    stop(): Promise<void>;
}
export {};
