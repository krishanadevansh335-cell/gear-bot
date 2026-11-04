export declare const DEFAULT_PROHIBITED_ROLES: string[];
export interface NativeOnboardingPromptOption {
    id?: string;
    title: string;
    description?: string;
    emoji?: {
        id?: string;
        name: string;
    };
    role_ids?: string[];
    channel_ids?: string[];
}
export interface NativeOnboardingPrompt {
    id?: string;
    title: string;
    options: NativeOnboardingPromptOption[];
    single_select: boolean;
    required: boolean;
    in_onboarding: boolean;
    type: number;
}
export interface NativeOnboardingConfig {
    prompts: NativeOnboardingPrompt[];
    default_channel_ids: string[];
    enabled: boolean;
    mode: number;
}
export interface OnboardingResult {
    success: boolean;
    message: string;
    /**
     * The raw Discord API response body from the PUT request.
     * Used for read-back verification. Never contains bot tokens.
     */
    data?: any;
    /**
     * The current onboarding state fetched after the PUT (read-back verification).
     * Confirms the live Discord state matches what was submitted.
     */
    readBack?: any;
    /**
     * Structured error detail when success is false.
     * httpStatus and rawBody are included so the caller can report
     * the exact Discord API failure without swallowing it.
     */
    error?: {
        httpStatus: number | string;
        rawBody: string;
    };
}
export declare class NativeOnboardingProvisioner {
    private rest;
    private guildId;
    constructor(token: string, guildId: string);
    /**
     * Builds the standard 3-question gaming community native onboarding prompts.
     *
     * Attaches preference role_ids to options when optionToRoleId is provided, while
     * maintaining channel_ids pointing at #verify so Discord API requirements are satisfied.
     *
     * @param verifyChannelId  The Discord channel ID of #verify (must exist before calling)
     * @param optionToRoleId   Optional mapping of option title (lowercase) -> Discord role ID
     */
    buildStandardGamingPrompts(verifyChannelId?: string, optionToRoleId?: Map<string, string>): NativeOnboardingPrompt[];
    /**
     * Validates that no prompt option assigns a sensitive or unauthorized role via native onboarding.
     * Enforces fail-closed security:
     * 1. If any option has role_ids and the role mapping is not provided -> FAILS CLOSED.
     * 2. If any role_id cannot be resolved against the guild -> FAILS CLOSED.
     * 3. If any resolved role is in prohibitedRoles -> REJECTS with explicit error.
     *
     * @param prompts           Prompts to validate
     * @param roleIdToName      Map of role ID → role name from the actual guild
     * @param additionalRoles   Optional additional prohibited role names
     */
    validateNoSensitiveRoles(prompts: NativeOnboardingPrompt[], roleIdToName?: Map<string, string>, additionalRoles?: string[]): void;
    /**
     * Fetches the current native onboarding configuration from Discord.
     * Logs ONBOARDING_FETCH_STARTED and ONBOARDING_FETCH_SUCCESS / failure.
     * Never swallows errors — the raw error detail is returned in the result.
     */
    getOnboarding(): Promise<{
        ok: boolean;
        data?: any;
        httpStatus?: number | string;
        rawBody?: string;
    }>;
    /**
     * Syncs native onboarding configuration to Discord via PUT.
     *
     * Requires the bot to have MANAGE_GUILD and MANAGE_ROLES permissions.
     * Requires the server to have Community mode enabled.
     *
     * Steps:
     *   1. Validate no sensitive roles in prompts (guard)
     *   2. Log ONBOARDING_UPDATE_STARTED
     *   3. PUT /guilds/{id}/onboarding
     *   4. Log ONBOARDING_UPDATE_SUCCESS or ONBOARDING_UPDATE_FAILED with exact HTTP detail
     *   5. Read-back via GET and compare prompt count
     *
     * NOTE: Discord Community Onboarding completion is NOT observable via gateway events.
     * member.pending covers Membership Screening (rules modal) only.
     * This method configures the native question flow; it does NOT enable Rules Screening —
     * that must be configured separately in Server Settings → Safety Setup.
     *
     * @param defaultChannelIds  Channel IDs Discord shows new members by default
     * @param enabled            Whether to enable the onboarding flow (requires Community)
     * @param roleIdToName       Optional role ID→name map for sensitive-role guard
     */
    syncOnboarding(defaultChannelIds: string[], enabled?: boolean, roleIdToName?: Map<string, string>, optionToRoleId?: Map<string, string>): Promise<OnboardingResult>;
}
