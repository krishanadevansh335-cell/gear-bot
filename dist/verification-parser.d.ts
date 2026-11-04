/**
 * Verification Natural Language Parser & Conversational Engine
 *
 * Implements flexible parsing with normalization, aliases, conversational feedback,
 * and privacy safeguards for Discord server onboarding.
 */
export interface ParsedSchedule {
    raw: string;
    timings: string[];
    displayTiming: string;
    timezone: string | null;
    isAllDay: boolean;
    needsTimezoneFollowup: boolean;
    conversationalResponse: string;
}
export interface ParsedLookingFor {
    raw: string;
    preferences: string[];
    isAll: boolean;
    conversationalResponse: string;
}
export interface ParsedGender {
    raw: string;
    gender: "Male" | "Female" | "Non-binary" | null;
    isSkipped: boolean;
    isValid: boolean;
    conversationalResponse: string;
}
export interface ParsedGameItem {
    game: string;
    slug: string;
    platform?: string;
    skill?: string;
    missingPlatform: boolean;
    missingSkill: boolean;
}
export interface ParsedGamesResult {
    raw: string;
    games: ParsedGameItem[];
    unlistedGames: string[];
    conversationalResponse: string;
}
export interface ConfirmationSummaryData {
    gamesStr: string;
    platformsStr: string;
    skillLevelsStr: string;
    scheduleStr: string;
    timezoneStr: string;
    lookingForStr: string;
    voiceLanguageStr: string;
    ageClassificationStr: string;
    isMinor: boolean;
}
export declare function extractTimezone(text: string): string | null;
export declare function parseSchedule(input: string): ParsedSchedule;
export declare function parseLookingFor(input: string): ParsedLookingFor;
export declare function parseGender(input: string): ParsedGender;
export declare function parseGamesNatural(input: string, catalog?: {
    name: string;
    slug: string;
    aliases: string[];
}[]): ParsedGamesResult;
export declare function buildConfirmationSummary(answers: Record<string, any>): ConfirmationSummaryData;
export declare function formatConfirmationCard(data: ConfirmationSummaryData): string;
/**
 * Detects whether a message posted in public chat contains sensitive verification
 * data (e.g. personal age disclosure or gender onboarding answers), while allowing
 * harmless gaming messages like "I play Apex 2" or "Looking for 5 teammates".
 */
export declare function detectSensitiveLeak(text: string): {
    isLeak: boolean;
    reason?: string;
};
export interface AgeValidationResult {
    valid: boolean;
    ageGroup?: "minor" | "adult";
    error?: string;
    isUnderage?: boolean;
}
/**
 * Validates age input with strict integer checks, boundaries, and under-13 protections.
 * Never stores or returns the raw age number.
 */
export declare function validateAgeInput(rawAge: string): AgeValidationResult;
