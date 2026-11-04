import { ColorResolvable } from "discord.js";
export interface OnboardingRoleMappingRule {
    question: string;
    option: string;
    roleName: string;
    category: "game" | "platform" | "experience";
    color?: ColorResolvable;
}
export declare const ONBOARDING_MAPPING_RULES: OnboardingRoleMappingRule[];
export interface ResolvedMappingItem {
    question: string;
    option: string;
    roleName: string;
    roleId?: string;
    position?: number;
    exists: boolean;
    assignable: boolean;
    isSensitive: boolean;
    status: "READY" | "MISSING" | "UNASSIGNABLE" | "PROHIBITED";
    notes?: string;
}
export interface OnboardingMappingResolution {
    ready: boolean;
    items: ResolvedMappingItem[];
    missingRoles: string[];
    unassignableRoles: string[];
    prohibitedRoles: string[];
    optionToRoleId: Map<string, string>;
}
/**
 * Resolves onboarding rules against existing Discord roles and bot hierarchy
 */
export declare function resolveOnboardingRoleMapping(rolesList: Array<{
    id: string;
    name: string;
    position: number;
}>, botHighestPosition: number): OnboardingMappingResolution;
