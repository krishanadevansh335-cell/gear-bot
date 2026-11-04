import { ActionRowBuilder, ButtonBuilder, ModalBuilder } from "discord.js";
/**
 * Builds the initial public Welcome / Start Verification message in #verify
 */
export declare function buildPublicVerifyWelcome(rulesChannelId?: string): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Step 1: Age Classification
 */
export declare function buildStepAgePayload(): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Modal for entering exact age
 */
export declare function buildAgeInputModal(): ModalBuilder;
/**
 * Builds Step 2: Gender (Optional)
 */
export declare function buildStepGenderPayload(): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Step 3: Games selection
 */
export declare function buildStepGamesPayload(existingGames?: any[], gamesCatalog?: any[]): {
    content: string;
    components: any[];
};
/**
 * Builds Step for configuring missing platform & skill for a selected game
 */
export declare function buildMissingPlatformSkillPayload(gameName: string): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
export declare function buildMissingSkillPayload(gameName: string, platform: string): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Step 4: Schedule and Timezone
 */
export declare function buildStepTimingPayload(currentTiming?: string, currentTimezone?: string): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Step 5: What are you looking for?
 */
export declare function buildStepLookingPayload(selected?: string[]): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Step 6: Voice Language (Optional)
 */
export declare function buildStepLanguagePayload(currentLang?: string | null): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Final Confirmation Summary Screen
 */
export declare function buildConfirmationPayload(answers: Record<string, any>): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Detected Onboarding Preferences Payload for members who completed Discord native onboarding
 */
export declare function buildOnboardingDetectedPayload(answers: {
    games?: Array<{
        game: string;
        platform?: string;
        skill?: string;
    }>;
    platforms?: string[];
    experiences?: string[];
}): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Question 2 of Onboarding: Platform Selection
 * Reuses the exact 5 platforms configured in Discord native onboarding
 */
export declare function buildOnboardingPlatformPayload(selectedPlatforms?: string[]): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds Question 3 of Onboarding: Gaming Experience Selection
 * Reuses the exact 7 experiences configured in Discord native onboarding
 */
export declare function buildOnboardingExperiencePayload(selectedExperiences?: string[]): {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
};
