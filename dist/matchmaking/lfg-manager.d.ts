import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ModalBuilder, User } from "discord.js";
import { LfgParty } from "../game-db.js";
/**
 * Builds the interactive LFG Party Card Embed with real-time roster and action buttons.
 */
export declare function buildLfgPartyEmbed(party: LfgParty, hostUser?: User | {
    id: string;
    username: string;
}): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds the interactive Modal for creating a new LFG party.
 */
export declare function buildCreatePartyModal(defaultGame?: string): ModalBuilder;
/**
 * Builds an embed listing all active LFG parties.
 */
export declare function buildActivePartiesListEmbed(parties: LfgParty[]): {
    embed: EmbedBuilder;
};
