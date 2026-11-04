import { Guild } from "discord.js";
export interface BotRemediationResult {
    botName: string;
    roleId: string;
    roleName: string;
    position: number;
    success: boolean;
    action: "revoked" | "manual_required" | "unchanged";
    notes: string;
}
export interface ChannelProvisioningAction {
    action: "create" | "rename" | "reparent" | "verified";
    type: "category" | "text" | "voice";
    name: string;
    id?: string;
    categoryName?: string;
    notes?: string;
}
export interface BotOverwriteAction {
    channelName: string;
    botName: string;
    botId: string;
    allowedPerms: string[];
    success: boolean;
    notes?: string;
}
export interface ArchitectureExecutionReport {
    status: "SUCCESS" | "PARTIAL" | "FAILED";
    botRemediations: BotRemediationResult[];
    channelActions: ChannelProvisioningAction[];
    botOverwrites: BotOverwriteAction[];
    manualActions: string[];
}
export declare class BotArchitectureProvisioner {
    private guild;
    constructor(guild: Guild);
    /**
     * Batch 1: Revoke guild-wide Administrator from third-party bots where hierarchy allows
     */
    remediateBotAdministratorRoles(previewOnly?: boolean): Promise<BotRemediationResult[]>;
    /**
     * Batch 2: Structure categories & channels cleanly, reusing existing resources
     */
    provisionCategoriesAndChannels(previewOnly?: boolean): Promise<ChannelProvisioningAction[]>;
    /**
     * Batch 3: Apply least-privilege channel overwrites for designated bots
     */
    configureBotChannelOverwrites(previewOnly?: boolean): Promise<BotOverwriteAction[]>;
}
