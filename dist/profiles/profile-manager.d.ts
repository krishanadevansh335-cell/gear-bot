import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ModalBuilder, StringSelectMenuBuilder, User } from "discord.js";
import { MemberProfile, Badge } from "../game-db.js";
/**
 * Builds the official GAMING SHAMING Member Profile Embed.
 * Uses Discord native embeds, styled with Electric Purple (#8A2BE2) and Cyber Cyan (#00F0FF).
 * Guarantees ZERO disclosure of sensitive verification fields (age, gender).
 */
export declare function buildProfileEmbed(targetUser: User | {
    id: string;
    username: string;
    displayAvatarURL?: () => string;
}, profile: MemberProfile, badges?: Badge[], rankIndex?: number): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds modal for updating bio, primary game, and timezone.
 */
export declare function buildProfileEditModal(currentProfile?: Partial<MemberProfile>): ModalBuilder;
/**
 * Builds selection rows for platform, playstyle, and schedule preferences.
 */
export declare function buildProfilePreferencesRows(currentProfile?: Partial<MemberProfile>): ActionRowBuilder<StringSelectMenuBuilder>[];
