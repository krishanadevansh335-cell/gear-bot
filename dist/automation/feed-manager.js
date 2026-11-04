import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
/**
 * Builds the Steam Special Deal Embed for #game-news.
 */
export function buildSteamDealEmbed(deal) {
    const embed = new EmbedBuilder()
        .setColor("#00F0FF")
        .setAuthor({ name: "GAMER GEAR // STEAM INTELLIGENCE FEED" })
        .setTitle(`🔥 STEAM DEAL: ${deal.title.toUpperCase()} (-${deal.discountPercent}%)`)
        .setDescription(`Special promotion detected on the Steam Store:\n\n` +
        `• **Discount:** \`-${deal.discountPercent}% OFF\`\n` +
        `• **Original Price:** ~~\`${deal.originalPrice}\`~~\n` +
        `• **Sale Price:** **\`${deal.salePrice}\`**\n` +
        (deal.expiryStr ? `• **Offer Ends:** \`${deal.expiryStr}\`\n` : "") +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        .setFooter({ text: "GAMING SHAMING • Game News & Steam Feeds • Auto-Polled" })
        .setTimestamp();
    if (deal.headerImage) {
        embed.setImage(deal.headerImage);
    }
    const storeBtn = new ButtonBuilder()
        .setLabel("🛒 View Deal on Steam Store")
        .setStyle(ButtonStyle.Link)
        .setURL(deal.storeUrl);
    const steamDbBtn = new ButtonBuilder()
        .setLabel("📊 SteamDB Price History")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://steamdb.info/search/?a=app&q=${encodeURIComponent(deal.title)}`);
    const row = new ActionRowBuilder().addComponents(storeBtn, steamDbBtn);
    return { embed, components: [row] };
}
/**
 * Builds the Free-to-Keep Game Announcement Embed for #game-news.
 */
export function buildFreeGameEmbed(freebie) {
    const embed = new EmbedBuilder()
        .setColor("#10B981")
        .setAuthor({ name: "GAMER GEAR // FREE GAME ALERT" })
        .setTitle(`🎁 100% FREE TO KEEP: ${freebie.title.toUpperCase()}`)
        .setDescription(`> *"${freebie.description}"*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• **Platform:** \`${freebie.platform}\`\n` +
        `• **Offer Validity:** Claim before \`${freebie.expiryStr}\`\n` +
        `• **Cost:** **\`FREE (100% OFF)\`**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        .setFooter({ text: "GAMING SHAMING • Instant Freebie Alerts" })
        .setTimestamp();
    if (freebie.headerImage) {
        embed.setImage(freebie.headerImage);
    }
    const claimBtn = new ButtonBuilder()
        .setLabel(`🎮 Claim Free on ${freebie.platform}`)
        .setStyle(ButtonStyle.Link)
        .setURL(freebie.storeUrl);
    const row = new ActionRowBuilder().addComponents(claimBtn);
    return { embed, components: [row] };
}
/**
 * Builds the Weekly Automated Community Report for #server-updates.
 */
export function buildCommunityReportEmbed(report) {
    const topGameLines = report.topGames.length > 0
        ? report.topGames.map((g, idx) => `• #${idx + 1} **${g.name}** — \`${g.count} active players\``).join("\n")
        : "• Activity data accumulating...";
    const embed = new EmbedBuilder()
        .setColor("#8A2BE2")
        .setAuthor({ name: "GAMER GEAR // AUTOMATED COMMUNITY REPORT" })
        .setTitle(`📊 GAMING SHAMING WEEKLY DIGEST (WEEK ${report.weekNumber}, ${report.year})`)
        .setDescription("Automated community health, operational metrics, and gaming trends.\n\n" +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `**Server Engagement Metrics:**\n` +
        `• **Total Operatives:** \`${report.totalMembers} members\`\n` +
        `• **Verified Clearance:** \`${report.verifiedCount} cleared members\`\n` +
        `• **Active Matchmaking Squads:** \`${report.activeLfgParties} squads open\`\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `**Top Played Games This Week:**\n` +
        topGameLines)
        .setFooter({ text: "GAMING SHAMING • Autonomous Community Intelligence" })
        .setTimestamp();
    return { embed };
}
/**
 * Service orchestrating scheduled feeds with strict deduplication.
 */
export class AutomationFeedService {
    db;
    client;
    constructor(db, client) {
        this.db = db;
        this.client = client;
    }
    /**
     * Publishes a Steam deal if not already posted.
     */
    async publishSteamDeal(deal) {
        if (this.db.hasAutomationFeed("steam_deals", deal.id)) {
            return false; // Deduplication: already published
        }
        const config = this.db.getAutomationConfig("steam_deals");
        const channelId = config?.channel_id || "1566922341769023603"; // #game-news
        const channel = await this.client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            const { embed, components } = buildSteamDealEmbed(deal);
            const sent = await channel.send({ embeds: [embed], components });
            this.db.recordAutomationFeed("steam_deals", deal.id, deal.title, deal, channel.id, sent.id);
            return true;
        }
        return false;
    }
    /**
     * Publishes a free game alert if not already posted.
     */
    async publishFreeGame(freebie) {
        if (this.db.hasAutomationFeed("free_games", freebie.id)) {
            return false;
        }
        const config = this.db.getAutomationConfig("free_games");
        const channelId = config?.channel_id || "1566922341769023603"; // #game-news
        const channel = await this.client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            const { embed, components } = buildFreeGameEmbed(freebie);
            const sent = await channel.send({ embeds: [embed], components });
            this.db.recordAutomationFeed("free_games", freebie.id, freebie.title, freebie, channel.id, sent.id);
            return true;
        }
        return false;
    }
    /**
     * Publishes the weekly community status digest.
     */
    async publishCommunityReport(report) {
        const reportKey = `weekly_report_${report.year}_w${report.weekNumber}`;
        if (this.db.hasAutomationFeed("community_report", reportKey)) {
            return false;
        }
        const config = this.db.getAutomationConfig("community_report");
        const channelId = config?.channel_id || "1566922320130351275"; // #server-updates
        const channel = await this.client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            const { embed } = buildCommunityReportEmbed(report);
            const sent = await channel.send({ embeds: [embed] });
            this.db.recordAutomationFeed("community_report", reportKey, `Weekly Report W${report.weekNumber}`, report, channel.id, sent.id);
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=feed-manager.js.map