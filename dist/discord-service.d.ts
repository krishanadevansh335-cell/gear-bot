import { Guild } from "discord.js";
import { AppConfig } from "./config.js";
export declare class DiscordService {
    private client;
    private config;
    private isReady;
    constructor(config: AppConfig);
    connect(): Promise<void>;
    getGuild(): Guild;
    getServerInfo(): Promise<any>;
    listServerStructure(): Promise<any>;
    createCategory(name: string): Promise<any>;
    createTextChannel(name: string, categoryId?: string, topic?: string): Promise<any>;
    createVoiceChannel(name: string, categoryId?: string, userLimit?: number): Promise<any>;
    createRole(params: {
        name: string;
        color?: string;
        hoist?: boolean;
        mentionable?: boolean;
        permissions?: string[];
    }): Promise<any>;
    setChannelPermissions(params: {
        channelId: string;
        targetId: string;
        allow?: string[];
        deny?: string[];
    }): Promise<any>;
    sendMessage(channelId: string, content: string): Promise<any>;
    renameChannel(channelId: string, newName: string): Promise<any>;
    deleteChannel(channelId: string, confirmation: boolean): Promise<any>;
    deleteRole(roleId: string, confirmation: boolean): Promise<any>;
    applyServerTemplate(template: any, previewOnly?: boolean): Promise<any>;
    isClientReady(): boolean;
}
