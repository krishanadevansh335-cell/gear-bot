import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, User } from "discord.js";
import { MemberProfile } from "../game-db.js";
/**
 * Builds the /rank progression card using Discord native embeds.
 */
export declare function buildRankEmbed(targetUser: User | {
    id: string;
    username: string;
    displayAvatarURL?: () => string;
}, profile: MemberProfile, rankIndex?: number, totalMembers?: number): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds the server-wide top 10 leaderboard embed.
 */
export declare function buildLeaderboardEmbed(entries: Array<MemberProfile & {
    rank: number;
}>, requesterId?: string): {
    embed: EmbedBuilder;
};
