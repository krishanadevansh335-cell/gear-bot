export interface AppConfig {
    discordToken: string;
    guildId: string;
    port: number;
    mcpAuthToken?: string;
}
export declare function loadConfig(): AppConfig;
export declare function validateDiscordConfig(config: AppConfig): {
    valid: boolean;
    error?: string;
};
