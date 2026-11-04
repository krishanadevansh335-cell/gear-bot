import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
/**
 * Builds the interactive /games directory embed with category picker.
 */
export function buildGamesCatalogEmbed(categories, games, selectedCategorySlug) {
    const currentCategory = selectedCategorySlug
        ? categories.find(c => c.id === selectedCategorySlug) || categories[0]
        : categories[0];
    const filteredGames = currentCategory
        ? games.filter(g => g.category_id === currentCategory.id)
        : games;
    const gameLines = filteredGames.length > 0
        ? filteredGames.slice(0, 15).map(g => {
            return `• **${g.name}** — Role: \`@${g.role_name}\` (${g.member_count} players)`;
        }).join("\n")
        : "*No games found in this category.*";
    const embed = new EmbedBuilder()
        .setColor("#00F0FF")
        .setTitle(`🎮 GAMING SHAMING Directory // ${currentCategory?.name || "All Games"}`)
        .setDescription(`Browse supported multiplayer games. Claim roles in <#1566898712519901224> to access private squad channels.\n\n` +
        gameLines)
        .setFooter({
        text: `Showing ${Math.min(15, filteredGames.length)} of ${filteredGames.length} games in ${currentCategory?.name || "Category"}`
    })
        .setTimestamp();
    // Category select menu
    const menu = new StringSelectMenuBuilder()
        .setCustomId("games_category_select")
        .setPlaceholder(`Filter Category: ${currentCategory?.name || "Select Category"}`)
        .addOptions(categories.slice(0, 25).map(cat => new StringSelectMenuOptionBuilder()
        .setLabel(cat.name.slice(0, 50))
        .setValue(cat.id)
        .setDefault(cat.id === currentCategory?.id)));
    const chooseRolesBtn = new ButtonBuilder()
        .setLabel("🎮 Choose Roles in #choose-roles")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.com/channels/924325170972340264/1566898712519901224");
    const row1 = new ActionRowBuilder().addComponents(menu);
    const row2 = new ActionRowBuilder().addComponents(chooseRolesBtn);
    return { embed, components: [row1, row2] };
}
/**
 * Builds an embed displaying a specific member's registered games.
 */
export function buildUserGamesEmbed(targetUser, userGames = []) {
    const avatarUrl = typeof targetUser.displayAvatarURL === "function"
        ? targetUser.displayAvatarURL()
        : undefined;
    const lines = userGames.length > 0
        ? userGames.map(g => `• **${g.game_slug.toUpperCase()}** — Platform: \`${g.platform}\` | Skill: \`${g.skill}\``).join("\n")
        : "*No personal games configured yet. Use /edit-profile or visit #choose-roles to select games!*";
    const embed = new EmbedBuilder()
        .setColor("#8A2BE2")
        .setAuthor({
        name: `GAMER GEAR // SQUAD ROSTER`,
        iconURL: avatarUrl
    })
        .setTitle(`🎮 ${targetUser.username}'s Game Roster (${userGames.length} Games)`)
        .setDescription(lines)
        .setFooter({ text: "GAMING SHAMING • Squad Roster" })
        .setTimestamp();
    if (avatarUrl) {
        embed.setThumbnail(avatarUrl);
    }
    const profileBtn = new ButtonBuilder()
        .setCustomId(`profile_view_${targetUser.id}`)
        .setLabel("🎮 Back to Profile")
        .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(profileBtn);
    return { embed, components: [row] };
}
//# sourceMappingURL=game-browser.js.map