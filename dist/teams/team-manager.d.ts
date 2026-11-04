import { EmbedBuilder } from "discord.js";
import { Team } from "../game-db.js";
/**
 * Builds the official GAMING SHAMING Team / Clan Dossier Embed.
 */
export declare function buildTeamEmbed(team: Team): {
    embed: EmbedBuilder;
};
