import { DiscordService } from "./discord-service.js";
export type ProvisioningStatus = "FULL SUCCESS" | "PARTIAL SUCCESS" | "FAILED";
export interface PermissionPreflight {
    canManageRoles: boolean;
    canManageChannels: boolean;
    canViewChannels: boolean;
    botHighestRole: {
        name: string;
        position: number;
    };
    missingBotPermissions: string[];
}
export interface ChannelAccessAudit {
    channelName: string;
    channelId: string;
    category: string;
    access: {
        everyone: boolean;
        minor: boolean;
        adult: boolean;
        verified: boolean;
        staff: boolean;
    };
    positiveChecksPassed: boolean;
    negativeChecksPassed: boolean;
    isolationCompliant: boolean;
    isolationNotes?: string;
}
export interface ProvisioningOperationDetail {
    action: "create_role" | "rename_role" | "create_category" | "create_channel" | "set_permission";
    target: string;
    targetId?: string;
    success: boolean;
    error?: {
        code: number | string;
        message: string;
        route?: string;
    };
}
export interface StructuredProvisioningReport {
    status: ProvisioningStatus;
    summary: string;
    preflight: PermissionPreflight;
    existingResources: {
        roles: {
            id: string;
            name: string;
        }[];
        categories: {
            id: string;
            name: string;
        }[];
        channels: {
            id: string;
            name: string;
            type: string;
        }[];
    };
    createdResources: {
        roles: string[];
        categories: string[];
        channels: string[];
    };
    successfulOverwrites: string[];
    failedOperations: ProvisioningOperationDetail[];
    accessAudit: ChannelAccessAudit[];
    requiredManualActions: string[];
}
export declare class DiscordProvisioner {
    private discordService;
    constructor(discordService: DiscordService);
    /**
     * Performs preflight checks on the bot's permissions and role hierarchy.
     */
    checkPreflight(): Promise<PermissionPreflight>;
    /**
     * Idempotent Server Provisioning with preflight checks, atomic tracking, and structured reporting.
     */
    provisionServer(previewOnly?: boolean): Promise<StructuredProvisioningReport>;
}
