import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, Client } from "discord.js";
import { GameDatabase } from "../game-db.js";
export interface SteamDealItem {
    id: string;
    title: string;
    discountPercent: number;
    originalPrice: string;
    salePrice: string;
    storeUrl: string;
    headerImage?: string;
    expiryStr?: string;
}
export interface FreeGameItem {
    id: string;
    title: string;
    platform: string;
    storeUrl: string;
    expiryStr: string;
    description: string;
    headerImage?: string;
}
export interface CommunityReportData {
    weekNumber: number;
    year: number;
    totalMembers: number;
    verifiedCount: number;
    activeLfgParties: number;
    topGames: Array<{
        name: string;
        count: number;
    }>;
}
/**
 * Builds the Steam Special Deal Embed for #game-news.
 */
export declare function buildSteamDealEmbed(deal: SteamDealItem): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds the Free-to-Keep Game Announcement Embed for #game-news.
 */
export declare function buildFreeGameEmbed(freebie: FreeGameItem): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
/**
 * Builds the Weekly Automated Community Report for #server-updates.
 */
export declare function buildCommunityReportEmbed(report: CommunityReportData): {
    embed: EmbedBuilder;
};
/**
 * Service orchestrating scheduled feeds with strict deduplication.
 */
export declare class AutomationFeedService {
    private db;
    private client;
    constructor(db: GameDatabase, client: Client);
    /**
     * Publishes a Steam deal if not already posted.
     */
    publishSteamDeal(deal: SteamDealItem): Promise<boolean>;
    /**
     * Publishes a free game alert if not already posted.
     */
    publishFreeGame(freebie: FreeGameItem): Promise<boolean>;
    /**
     * Publishes the weekly community status digest.
     */
    publishCommunityReport(report: CommunityReportData): Promise<boolean>;
}
