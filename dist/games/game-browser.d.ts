import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, User } from "discord.js";
import { GameDefinition } from "../game-db.js";
/**
 * Builds the interactive /games directory embed with category picker.
 */
export declare function buildGamesCatalogEmbed(categories: any[], games: GameDefinition[], selectedCategorySlug?: string): {
    embed: EmbedBuilder;
    components: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[];
};
/**
 * Builds an embed displaying a specific member's registered games.
 */
export declare function buildUserGamesEmbed(targetUser: User | {
    id: string;
    username: string;
    displayAvatarURL?: () => string;
}, userGames?: Array<{
    game_slug: string;
    platform: string;
    skill: string;
}>): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
