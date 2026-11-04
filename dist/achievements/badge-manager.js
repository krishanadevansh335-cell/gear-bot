import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
const TIER_COLORS = {
    bronze: "#CD7F32",
    silver: "#E2E8F0",
    gold: "#FBBF24",
    diamond: "#38BDF8",
    mythic: "#A855F7"
};
/**
 * Builds the official GAMING SHAMING Badges Showcase Embed.
 */
export function buildBadgesEmbed(targetUser, userBadges = [], allBadges = []) {
    const avatarUrl = typeof targetUser.displayAvatarURL === "function"
        ? targetUser.displayAvatarURL()
        : undefined;
    const earnedSlugs = new Set(userBadges.map(b => b.slug));
    const lockedBadges = allBadges.filter(b => !earnedSlugs.has(b.slug));
    const earnedLines = userBadges.length > 0
        ? userBadges.map(b => {
            const dateStr = b.awarded_at ? new Date(b.awarded_at).toLocaleDateString() : "Active";
            return `${b.emoji} **${b.name}** [${b.tier.toUpperCase()}]\n↳ *${b.description}* (Awarded: ${dateStr})`;
        }).join("\n\n")
        : "*No badges earned yet. Complete verification, play in scrims, and squad up to unlock honor badges!*";
    const lockedLines = lockedBadges.length > 0
        ? lockedBadges.slice(0, 5).map(b => `${b.emoji} **${b.name}** [${b.tier.toUpperCase()}] — *${b.description}*`).join("\n")
        : "*All available badges unlocked! True gaming legend.*";
    const embed = new EmbedBuilder()
        .setColor("#00F0FF")
        .setAuthor({
        name: `GAMER GEAR // HALL OF HONORS`,
        iconURL: avatarUrl
    })
        .setTitle(`🏆 ${targetUser.username}'s Honor Badges (${userBadges.length} Unlocked)`)
        .setDescription("Badges signify proven skills, sportsmanship, and contributions in **GAMING SHAMING**.")
        .addFields({
        name: "🎖️ Unlocked Badges",
        value: earnedLines,
        inline: false
    }, {
        name: "🔒 Next Available Badges",
        value: lockedLines,
        inline: false
    })
        .setFooter({
        text: "GAMING SHAMING • Achievements & Honors • /badges",
        iconURL: avatarUrl
    })
        .setTimestamp();
    if (avatarUrl) {
        embed.setThumbnail(avatarUrl);
    }
    const profileBtn = new ButtonBuilder()
        .setCustomId(`profile_view_${targetUser.id}`)
        .setLabel("🎮 View Profile")
        .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(profileBtn);
    return { embed, components: [row] };
}
//# sourceMappingURL=badge-manager.js.map