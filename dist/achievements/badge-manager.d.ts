import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, User } from "discord.js";
import { Badge } from "../game-db.js";
/**
 * Builds the official GAMING SHAMING Badges Showcase Embed.
 */
export declare function buildBadgesEmbed(targetUser: User | {
    id: string;
    username: string;
    displayAvatarURL?: () => string;
}, userBadges?: Badge[], allBadges?: Badge[]): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
