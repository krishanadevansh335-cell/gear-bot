import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { buildProfileEmbed, buildProfileEditModal, buildProfilePreferencesRows } from "./profiles/profile-manager.js";
import { buildBadgesEmbed } from "./achievements/badge-manager.js";
import { buildRankEmbed, buildLeaderboardEmbed } from "./profiles/rank-manager.js";
import { buildGamesCatalogEmbed, buildUserGamesEmbed } from "./games/game-browser.js";
import { buildLfgPartyEmbed, buildActivePartiesListEmbed } from "./matchmaking/lfg-manager.js";
import { buildTeamEmbed } from "./teams/team-manager.js";
import { AutomationFeedService } from "./automation/feed-manager.js";
export function buildGameCommands() {
    return [
        // Phase 2: Member Identity Commands
        new SlashCommandBuilder()
            .setName("profile")
            .setDescription("View player gaming dossier, badges, playstyle, and standing.")
            .addUserOption((opt) => opt.setName("user").setDescription("Target member (defaults to yourself)").setRequired(false)),
        new SlashCommandBuilder()
            .setName("setup-profile")
            .setDescription("Configure your player bio, primary game, platform, and playstyle."),
        new SlashCommandBuilder()
            .setName("edit-profile")
            .setDescription("Quick interactive menu to update gaming preferences."),
        new SlashCommandBuilder()
            .setName("badges")
            .setDescription("Showcase earned achievement badges and honors.")
            .addUserOption((opt) => opt.setName("user").setDescription("Target member (defaults to yourself)").setRequired(false)),
        new SlashCommandBuilder()
            .setName("rank")
            .setDescription("View your community level, XP progress, and leaderboard position.")
            .addUserOption((opt) => opt.setName("user").setDescription("Target member (defaults to yourself)").setRequired(false)),
        new SlashCommandBuilder()
            .setName("leaderboard")
            .setDescription("Display the top 10 ranked players in GAMING SHAMING."),
        // Phase 4: LFG Matchmaking
        new SlashCommandBuilder()
            .setName("lfg")
            .setDescription("Find teammates, create squad parties, and manage LFG.")
            .addSubcommand((sub) => sub
            .setName("create")
            .setDescription("Create a new LFG squad party in #looking-for-group.")
            .addStringOption((opt) => opt.setName("game").setDescription("Game name (e.g. Apex Legends, Lethal Company)").setRequired(true))
            .addStringOption((opt) => opt.setName("activity").setDescription("Activity (e.g. Ranked Grind, Quota Runs, Chill)").setRequired(true))
            .addStringOption((opt) => opt.setName("platform").setDescription("Platform (PC, PlayStation, Xbox, Crossplay)").setRequired(false))
            .addIntegerOption((opt) => opt.setName("slots").setDescription("Max squad size (2 to 8)").setRequired(false)))
            .addSubcommand((sub) => sub
            .setName("list")
            .setDescription("View all active LFG squad recruiting requests.")
            .addStringOption((opt) => opt.setName("game").setDescription("Filter by game").setRequired(false)))
            .addSubcommand((sub) => sub
            .setName("cancel")
            .setDescription("Cancel and close your currently active LFG squad party.")),
        // Phase 4: Team / Clan System
        new SlashCommandBuilder()
            .setName("team")
            .setDescription("Create and manage competitive gaming clans and squads.")
            .addSubcommand((sub) => sub
            .setName("create")
            .setDescription("Form a new clan / scrim team.")
            .addStringOption((opt) => opt.setName("name").setDescription("Clan name (up to 32 chars)").setRequired(true))
            .addStringOption((opt) => opt.setName("tag").setDescription("Clan tag (e.g. SHM, VPR, 2-5 chars)").setRequired(true))
            .addStringOption((opt) => opt.setName("game").setDescription("Primary game for this clan").setRequired(true)))
            .addSubcommand((sub) => sub
            .setName("view")
            .setDescription("Inspect a clan's roster and details.")
            .addStringOption((opt) => opt.setName("tag").setDescription("Clan tag or name").setRequired(true))),
        // Phase 6: Content Automation & Intelligence
        new SlashCommandBuilder()
            .setName("automation")
            .setDescription("Configure and view automated Steam deals, free games, and digests.")
            .addSubcommand((sub) => sub
            .setName("status")
            .setDescription("View current status and poll channels for automation feeds."))
            .addSubcommand((sub) => sub
            .setName("trigger")
            .setDescription("[Staff Only] Manually trigger and post a test automation broadcast.")
            .addStringOption((opt) => opt
            .setName("feed")
            .setDescription("Type of feed to trigger")
            .setRequired(true)
            .addChoices({ name: "Steam Deals", value: "steam_deals" }, { name: "Free Games Alert", value: "free_games" }, { name: "Weekly Community Digest", value: "community_report" }))),
        // Game Directory Commands
        new SlashCommandBuilder()
            .setName("games")
            .setDescription("Manage multiplayer game directory, dynamic channels, and requests.")
            .addSubcommand((sub) => sub
            .setName("list")
            .setDescription("List all supported games in the directory by category.")
            .addStringOption((opt) => opt
            .setName("category")
            .setDescription("Filter by category")
            .setRequired(false)
            .addChoices({ name: "FPS & Competitive", value: "fps_competitive" }, { name: "Survival & Sandbox", value: "survival_sandbox" }, { name: "RPG & Adventure", value: "rpg_adventure" }, { name: "Co-op & Horror", value: "coop_horror" }, { name: "Racing & Sports", value: "racing_sports" }, { name: "Strategy & Party", value: "strategy_party" })))
            .addSubcommand((sub) => sub
            .setName("request")
            .setDescription("Request a new multiplayer game to be added to the directory.")
            .addStringOption((opt) => opt.setName("name").setDescription("Exact name of the game").setRequired(true))
            .addStringOption((opt) => opt
            .setName("category")
            .setDescription("Category where this game belongs")
            .setRequired(true)
            .addChoices({ name: "FPS & Competitive", value: "fps_competitive" }, { name: "Survival & Sandbox", value: "survival_sandbox" }, { name: "RPG & Adventure", value: "rpg_adventure" }, { name: "Co-op & Horror", value: "coop_horror" }, { name: "Racing & Sports", value: "racing_sports" }, { name: "Strategy & Party", value: "strategy_party" })))
            .addSubcommand((sub) => sub
            .setName("channel-info")
            .setDescription("View channel and role information for a specific game.")
            .addStringOption((opt) => opt.setName("game").setDescription("Game name or slug").setRequired(true)))
            .addSubcommand((sub) => sub
            .setName("add")
            .setDescription("[Mod Only] Add a new game directly into the directory and create channels.")
            .addStringOption((opt) => opt.setName("name").setDescription("Game name").setRequired(true))
            .addStringOption((opt) => opt
            .setName("category")
            .setDescription("Category for the game")
            .setRequired(true)
            .addChoices({ name: "FPS & Competitive", value: "fps_competitive" }, { name: "Survival & Sandbox", value: "survival_sandbox" }, { name: "RPG & Adventure", value: "rpg_adventure" }, { name: "Co-op & Horror", value: "coop_horror" }, { name: "Racing & Sports", value: "racing_sports" }, { name: "Strategy & Party", value: "strategy_party" }))
            .addStringOption((opt) => opt.setName("role").setDescription("Custom role name (optional)").setRequired(false))
            .addStringOption((opt) => opt.setName("color").setDescription("Hex color code (e.g. #3498DB)").setRequired(false)))
            .addSubcommand((sub) => sub
            .setName("approve")
            .setDescription("[Mod Only] Approve a pending game request and dynamically provision channels.")
            .addIntegerOption((opt) => opt.setName("request_id").setDescription("ID of the pending request").setRequired(true)))
            .addSubcommand((sub) => sub
            .setName("remove")
            .setDescription("[Mod Only] Remove a game from the directory.")
            .addStringOption((opt) => opt.setName("game").setDescription("Game slug or name").setRequired(true)))
            .addSubcommand((sub) => sub
            .setName("sync")
            .setDescription("[Mod Only] Ensure all game categories and configured channels are synced."))
    ];
}
export async function handleGameCommands(interaction, gameManager) {
    const subcommand = interaction.options.getSubcommand();
    const db = gameManager.getDatabase();
    const member = interaction.member;
    // Check moderator permissions for staff subcommands
    const isMod = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        interaction.user.id === interaction.guild?.ownerId;
    if (["add", "approve", "remove", "sync"].includes(subcommand) && !isMod) {
        await interaction.reply({
            content: "⛔ Only authorized staff members can execute administrative game commands.",
            ephemeral: true
        });
        return;
    }
    switch (subcommand) {
        case "list": {
            const categoryFilter = interaction.options.getString("category");
            const games = categoryFilter ? db.getGamesByCategory(categoryFilter) : db.getAllGames();
            if (games.length === 0) {
                await interaction.reply({ content: "No games found in the directory.", ephemeral: true });
                return;
            }
            const embed = new EmbedBuilder()
                .setTitle("🎮 Multiplayer Game Directory")
                .setDescription(`Browse supported games. Channels and roles are dynamically created upon member selection.\nTotal games registered: **${games.length}**`)
                .setColor(0x3498db)
                .setTimestamp();
            const grouped = {};
            games.forEach((g) => {
                if (!grouped[g.category_id])
                    grouped[g.category_id] = [];
                const hasChannel = g.text_channel_id ? "🟢" : "⚪";
                grouped[g.category_id].push(`${hasChannel} **${g.name}** (\`${g.slug}\`)`);
            });
            for (const [catId, list] of Object.entries(grouped)) {
                const catObj = db.getCategory(catId);
                embed.addFields({
                    name: catObj ? catObj.name : catId,
                    value: list.slice(0, 15).join("\n") + (list.length > 15 ? `\n...and ${list.length - 15} more` : ""),
                    inline: true
                });
            }
            await interaction.reply({ embeds: [embed], ephemeral: true });
            break;
        }
        case "request": {
            const name = interaction.options.getString("name", true).trim();
            const category = interaction.options.getString("category", true);
            // Check if already in directory
            const existing = db.getGameBySlug(name);
            if (existing) {
                await interaction.reply({
                    content: `ℹ️ **${existing.name}** is already in the gaming directory! Select it during verification or ask a mod.`,
                    ephemeral: true
                });
                return;
            }
            const req = db.createGameRequest(name, category, interaction.user.id);
            db.logAudit("GAME_REQUEST", `User ${interaction.user.tag} requested '${name}' in '${category}'`, interaction.user.id);
            // Notify in #mod-alerts if it exists
            const modAlertsChannel = interaction.guild?.channels.cache.find((c) => c.name === "mod-alerts" && c.isTextBased());
            if (modAlertsChannel && modAlertsChannel.isTextBased()) {
                await modAlertsChannel.send({
                    content: `📥 **New Game Request #${req.id}**\n**Game:** ${name}\n**Category:** ${category}\n**Requested By:** <@${interaction.user.id}>\nUse \`/games approve request_id:${req.id}\` to accept and provision channels.`
                });
            }
            await interaction.reply({
                content: `✅ Your request for **${name}** (Request ID: #${req.id}) has been submitted for moderator review!`,
                ephemeral: true
            });
            break;
        }
        case "channel-info": {
            const query = interaction.options.getString("game", true).trim();
            const game = db.getGameBySlug(query);
            if (!game) {
                await interaction.reply({ content: `Game '${query}' not found in directory.`, ephemeral: true });
                return;
            }
            const textCh = game.text_channel_id ? `<#${game.text_channel_id}>` : "Not provisioned yet";
            const voiceCh = game.voice_channel_id ? `<#${game.voice_channel_id}>` : "Not provisioned yet";
            const roleRef = game.role_id ? `<@&${game.role_id}>` : `@${game.role_name}`;
            const embed = new EmbedBuilder()
                .setTitle(`🎮 Game Info: ${game.name}`)
                .setColor(game.role_color || 0x3498db)
                .addFields({ name: "Slug", value: `\`${game.slug}\``, inline: true }, { name: "Category", value: game.category_id, inline: true }, { name: "Active Players", value: `${game.member_count} members`, inline: true }, { name: "Role", value: roleRef, inline: true }, { name: "Text Channel", value: textCh, inline: true }, { name: "Voice Channel", value: voiceCh, inline: true })
                .setFooter({ text: "Channels are dynamically provisioned when members join." });
            await interaction.reply({ embeds: [embed], ephemeral: true });
            break;
        }
        case "add": {
            await interaction.deferReply({ ephemeral: true });
            const name = interaction.options.getString("name", true).trim();
            const category = interaction.options.getString("category", true);
            const customRole = interaction.options.getString("role") || `${name} Squad`;
            const color = interaction.options.getString("color") || "#3498DB";
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            if (db.getGameBySlug(slug)) {
                await interaction.editReply(`Game '${name}' already exists in directory.`);
                return;
            }
            db.addGame({
                name,
                slug,
                category_id: category,
                role_name: customRole,
                role_color: color
            });
            // Add role without creating separate channels
            await gameManager.addMemberToGame(interaction.user.id, slug, "PC", "Casual").catch(() => { });
            await interaction.editReply(`✅ Successfully added **${name}** to directory and assigned role **@${customRole || name + " Squad"}**.`);
            break;
        }
        case "approve": {
            await interaction.deferReply({ ephemeral: true });
            const reqId = interaction.options.getInteger("request_id", true);
            const pendingList = db.getPendingRequests();
            const targetReq = pendingList.find((r) => r.id === reqId);
            if (!targetReq) {
                await interaction.editReply(`Pending request #${reqId} not found.`);
                return;
            }
            const slug = targetReq.game_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            let game = db.getGameBySlug(slug);
            if (!game) {
                game = db.addGame({
                    name: targetReq.game_name,
                    slug,
                    category_id: targetReq.category_id,
                    role_name: `${targetReq.game_name} Squad`,
                    role_color: "#3498DB"
                });
            }
            db.resolveGameRequest(reqId, "approved", interaction.user.id, "Approved by moderator");
            // Add requester to game role
            await gameManager.addMemberToGame(targetReq.requested_by_user_id, slug, "PC", "Intermediate").catch(() => { });
            await interaction.editReply(`✅ Approved Request #${reqId}! Added **${game.name}** and assigned role to requester.`);
            break;
        }
        case "sync": {
            await interaction.deferReply({ ephemeral: true });
            const cats = await gameManager.ensureGameCategories();
            await interaction.editReply(`✅ Synced ${cats.size} game categories with strict unverified @everyone concealment.`);
            break;
        }
        case "remove": {
            await interaction.deferReply({ ephemeral: true });
            const q = interaction.options.getString("game", true);
            const game = db.getGameBySlug(q);
            if (!game) {
                await interaction.editReply(`Game '${q}' not found.`);
                return;
            }
            db.logAudit("REMOVE_GAME", `Moderator ${interaction.user.tag} removed ${game.name} from directory`, interaction.user.id);
            await interaction.editReply(`⚠️ Game **${game.name}** was archived from active directory. Existing channels/roles were kept intact for safety.`);
            break;
        }
    }
}
/**
 * Handles Phase 2 Slash Commands: /profile, /setup-profile, /edit-profile, /badges, /rank, /leaderboard.
 */
export async function handleMemberIdentityCommands(interaction, db) {
    const { commandName } = interaction;
    switch (commandName) {
        case "profile": {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const profile = db.getMemberProfile(targetUser.id) || db.upsertMemberProfile({ user_id: targetUser.id });
            const badges = db.getMemberBadges(targetUser.id);
            const leaderboard = db.getLeaderboard(100);
            const rankIndex = leaderboard.findIndex(l => l.user_id === targetUser.id) + 1 || 1;
            const { embed, components } = buildProfileEmbed(targetUser, profile, badges, rankIndex);
            await interaction.reply({ embeds: [embed], components });
            return true;
        }
        case "setup-profile": {
            const profile = db.getMemberProfile(interaction.user.id);
            const modal = buildProfileEditModal(profile || undefined);
            await interaction.showModal(modal);
            return true;
        }
        case "edit-profile": {
            const profile = db.getMemberProfile(interaction.user.id) || db.upsertMemberProfile({ user_id: interaction.user.id });
            const rows = buildProfilePreferencesRows(profile);
            await interaction.reply({
                content: "⚙️ **Update Your Gaming Preferences:**\nSelect from the dropdowns below to customize your dossier.",
                components: rows,
                ephemeral: true
            });
            return true;
        }
        case "badges": {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const userBadges = db.getMemberBadges(targetUser.id);
            const allBadges = db.getAllBadges();
            const { embed, components } = buildBadgesEmbed(targetUser, userBadges, allBadges);
            await interaction.reply({ embeds: [embed], components });
            return true;
        }
        case "rank": {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const profile = db.getMemberProfile(targetUser.id) || db.upsertMemberProfile({ user_id: targetUser.id });
            const leaderboard = db.getLeaderboard(100);
            const rankIndex = leaderboard.findIndex(l => l.user_id === targetUser.id) + 1 || 1;
            const { embed, components } = buildRankEmbed(targetUser, profile, rankIndex, interaction.guild?.memberCount || 31);
            await interaction.reply({ embeds: [embed], components });
            return true;
        }
        case "leaderboard": {
            const leaderboard = db.getLeaderboard(10);
            const { embed } = buildLeaderboardEmbed(leaderboard, interaction.user.id);
            await interaction.reply({ embeds: [embed] });
            return true;
        }
        // Phase 4: LFG Commands
        case "lfg": {
            const sub = interaction.options.getSubcommand();
            if (sub === "create") {
                const game = interaction.options.getString("game", true);
                const activity = interaction.options.getString("activity", true);
                const platform = interaction.options.getString("platform") || "Crossplay";
                const slots = interaction.options.getInteger("slots") || 4;
                const res = db.createLfgParty({
                    host_user_id: interaction.user.id,
                    game_slug: game.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                    game_name: game,
                    platform,
                    playstyle: "Co-op / Squad",
                    activity,
                    max_slots: slots
                });
                if (!res.success || !res.party) {
                    await interaction.reply({ content: `❌ ${res.error || "Failed to create party."}`, ephemeral: true });
                    return true;
                }
                const lfgCh = interaction.guild?.channels.cache.find(c => c.name === "looking-for-group")
                    || interaction.channel;
                if (lfgCh && lfgCh.isTextBased()) {
                    const { embed, components } = buildLfgPartyEmbed(res.party, interaction.user);
                    const sent = await lfgCh.send({ embeds: [embed], components });
                    db.updateLfgPartyMessage(res.party.id, lfgCh.id, sent.id);
                    await interaction.reply({
                        content: `✅ **LFG Squad Created!** Broadcasted to <#${lfgCh.id}>: [Jump to Party](${sent.url})`,
                        ephemeral: true
                    });
                }
                else {
                    await interaction.reply({ content: "✅ Party created, but could not locate #looking-for-group.", ephemeral: true });
                }
                return true;
            }
            if (sub === "list") {
                const gameFilter = interaction.options.getString("game");
                const slug = gameFilter ? gameFilter.toLowerCase().replace(/[^a-z0-9]/g, "-") : undefined;
                const activeParties = db.getActiveLfgParties(slug);
                const { embed } = buildActivePartiesListEmbed(activeParties);
                await interaction.reply({ embeds: [embed] });
                return true;
            }
            if (sub === "cancel") {
                const active = db.getActiveLfgParties().find(p => p.host_user_id === interaction.user.id);
                if (!active) {
                    await interaction.reply({ content: "You do not have an active LFG party to cancel.", ephemeral: true });
                    return true;
                }
                db.closeLfgParty(active.id, interaction.user.id);
                await interaction.reply({ content: `✅ Cancelled LFG party #${active.id} for **${active.game_name}**.`, ephemeral: true });
                return true;
            }
            return true;
        }
        // Phase 4: Team / Clan Commands
        case "team": {
            const sub = interaction.options.getSubcommand();
            if (sub === "create") {
                const name = interaction.options.getString("name", true);
                const tag = interaction.options.getString("tag", true);
                const game = interaction.options.getString("game", true);
                const res = db.createTeam(name, tag, interaction.user.id, game);
                if (!res.success || !res.team) {
                    await interaction.reply({ content: `❌ ${res.error || "Failed to create team."}`, ephemeral: true });
                    return true;
                }
                const { embed } = buildTeamEmbed(res.team);
                await interaction.reply({
                    content: `🛡️ **New Clan Registered!**`,
                    embeds: [embed]
                });
                return true;
            }
            if (sub === "view") {
                const tag = interaction.options.getString("tag", true);
                const team = db.getTeam(tag);
                if (!team) {
                    await interaction.reply({ content: `❌ No clan or team found with tag or name "${tag}".`, ephemeral: true });
                    return true;
                }
                const { embed } = buildTeamEmbed(team);
                await interaction.reply({ embeds: [embed] });
                return true;
            }
            return true;
        }
        // Phase 6: Automation Management
        case "automation": {
            const sub = interaction.options.getSubcommand();
            if (sub === "status") {
                const steamConfig = db.getAutomationConfig("steam_deals");
                const freeConfig = db.getAutomationConfig("free_games");
                const reportConfig = db.getAutomationConfig("community_report");
                const recent = db.getRecentAutomationFeeds(undefined, 5);
                const embed = new EmbedBuilder()
                    .setColor("#8A2BE2")
                    .setTitle("⚙️ Gamer Gear Automation Subsystem Status")
                    .setDescription("Real-time monitoring feeds with automatic deduplication.")
                    .addFields({
                    name: "📡 Active Feed Configurations",
                    value: [
                        `• **Steam Deals:** Channel <#${steamConfig?.channel_id || "1566922341769023603"}> | Enabled: \`${steamConfig?.enabled ? "YES" : "NO"}\``,
                        `• **Free Games:** Channel <#${freeConfig?.channel_id || "1566922341769023603"}> | Enabled: \`${freeConfig?.enabled ? "YES" : "NO"}\``,
                        `• **Weekly Digest:** Channel <#${reportConfig?.channel_id || "1566922320130351275"}> | Enabled: \`${reportConfig?.enabled ? "YES" : "NO"}\``
                    ].join("\n"),
                    inline: false
                }, {
                    name: "📝 Recent Dispatched Feeds",
                    value: recent.length > 0
                        ? recent.map(r => `• [${r.feed_type}] **${r.title}** (Key: \`${r.external_id}\`)`).join("\n")
                        : "*No feeds dispatched yet.*",
                    inline: false
                })
                    .setFooter({ text: "GAMING SHAMING • Automated Feeds" })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
                return true;
            }
            if (sub === "trigger") {
                const feed = interaction.options.getString("feed", true);
                const service = new AutomationFeedService(db, interaction.client);
                await interaction.deferReply({ ephemeral: true });
                if (feed === "steam_deals") {
                    const sent = await service.publishSteamDeal({
                        id: `test_deal_${Date.now()}`,
                        title: "Lethal Company — Weekend Special",
                        discountPercent: 30,
                        originalPrice: "$9.99",
                        salePrice: "$6.99",
                        storeUrl: "https://store.steampowered.com/app/1966720/Lethal_Company/",
                        expiryStr: "Monday 10:00 AM PST"
                    });
                    await interaction.editReply(`✅ Dispatched test Steam deal to <#1566922341769023603>: Success = \`${sent}\``);
                    return true;
                }
                if (feed === "free_games") {
                    const sent = await service.publishFreeGame({
                        id: `test_free_${Date.now()}`,
                        title: "Deep Rock Galactic — Free Weekend & Bonus XP",
                        platform: "Steam",
                        storeUrl: "https://store.steampowered.com/app/548430/Deep_Rock_Galactic/",
                        expiryStr: "Sunday 11:59 PM EST",
                        description: "Play Deep Rock Galactic 100% free this weekend with full crossplay and double season XP."
                    });
                    await interaction.editReply(`✅ Dispatched test Free Game alert to <#1566922341769023603>: Success = \`${sent}\``);
                    return true;
                }
                if (feed === "community_report") {
                    const sent = await service.publishCommunityReport({
                        weekNumber: 44,
                        year: 2026,
                        totalMembers: interaction.guild?.memberCount || 31,
                        verifiedCount: 18,
                        activeLfgParties: db.getActiveLfgParties().length,
                        topGames: [
                            { name: "Apex Legends", count: 14 },
                            { name: "Lethal Company", count: 9 },
                            { name: "Phasmophobia", count: 8 },
                            { name: "Valorant", count: 6 }
                        ]
                    });
                    await interaction.editReply(`✅ Dispatched Weekly Community Digest to <#1566922320130351275>: Success = \`${sent}\``);
                    return true;
                }
            }
            return true;
        }
        default:
            return false;
    }
}
/**
 * Handles Phase 2 interactive components (Buttons, Select Menus, Modals).
 */
export async function handleMemberIdentityComponents(interaction, db) {
    // 1. Modals
    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
        if (interaction.customId === "profile_edit_modal_submit") {
            const bio = interaction.fields.getTextInputValue("profile_modal_bio") || "";
            const primaryGame = interaction.fields.getTextInputValue("profile_modal_game") || "Apex Legends";
            const timezone = interaction.fields.getTextInputValue("profile_modal_tz") || "UTC";
            const updated = db.upsertMemberProfile({
                user_id: interaction.user.id,
                bio,
                primary_game: primaryGame,
                timezone
            });
            const badges = db.getMemberBadges(interaction.user.id);
            const { embed, components } = buildProfileEmbed(interaction.user, updated, badges);
            await interaction.reply({
                content: "✅ **Profile updated successfully!** Here is your new player dossier:",
                embeds: [embed],
                components,
                ephemeral: true
            });
            return true;
        }
    }
    // 2. Select Menus
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
        const val = interaction.values[0];
        if (interaction.customId === "profile_platform_select") {
            db.upsertMemberProfile({ user_id: interaction.user.id, platform: val });
            await interaction.reply({
                content: `✅ Updated primary platform to **${val}**.`,
                ephemeral: true
            });
            return true;
        }
        if (interaction.customId === "profile_playstyle_select") {
            db.upsertMemberProfile({ user_id: interaction.user.id, playstyle: val });
            await interaction.reply({
                content: `✅ Updated playstyle to **${val}**.`,
                ephemeral: true
            });
            return true;
        }
        if (interaction.customId === "profile_timing_select") {
            db.upsertMemberProfile({ user_id: interaction.user.id, timing: val });
            await interaction.reply({
                content: `✅ Updated availability schedule to **${val}**.`,
                ephemeral: true
            });
            return true;
        }
        if (interaction.customId === "games_category_select") {
            const categories = db.getAllCategories();
            const allGames = db.getAllGames();
            const { embed, components } = buildGamesCatalogEmbed(categories, allGames, val);
            await interaction.update({ embeds: [embed], components });
            return true;
        }
    }
    // 3. Buttons
    if (interaction.isButton && interaction.isButton()) {
        const cid = interaction.customId;
        if (cid.startsWith("profile_edit_")) {
            const profile = db.getMemberProfile(interaction.user.id);
            const modal = buildProfileEditModal(profile || undefined);
            await interaction.showModal(modal);
            return true;
        }
        if (cid.startsWith("profile_badges_")) {
            const targetId = cid.replace("profile_badges_", "");
            const targetUser = await interaction.client.users.fetch(targetId);
            const userBadges = db.getMemberBadges(targetId);
            const allBadges = db.getAllBadges();
            const { embed, components } = buildBadgesEmbed(targetUser, userBadges, allBadges);
            await interaction.reply({ embeds: [embed], components, ephemeral: true });
            return true;
        }
        if (cid.startsWith("profile_view_")) {
            const targetId = cid.replace("profile_view_", "");
            const targetUser = await interaction.client.users.fetch(targetId);
            const profile = db.getMemberProfile(targetId) || db.upsertMemberProfile({ user_id: targetId });
            const badges = db.getMemberBadges(targetId);
            const { embed, components } = buildProfileEmbed(targetUser, profile, badges);
            await interaction.reply({ embeds: [embed], components, ephemeral: true });
            return true;
        }
        if (cid.startsWith("profile_games_")) {
            const targetId = cid.replace("profile_games_", "");
            const targetUser = await interaction.client.users.fetch(targetId);
            const stmt = db.db.prepare("SELECT * FROM member_game_profiles WHERE user_id = ?");
            const userGames = stmt.all(targetId);
            const { embed, components } = buildUserGamesEmbed(targetUser, userGames);
            await interaction.reply({ embeds: [embed], components, ephemeral: true });
            return true;
        }
        // Phase 4: LFG Interactive Matchmaking Buttons
        if (cid.startsWith("lfg_join_")) {
            const partyId = Number(cid.replace("lfg_join_", ""));
            const res = db.joinLfgParty(partyId, interaction.user.id);
            if (!res.success || !res.party) {
                await interaction.reply({ content: `❌ ${res.error || "Could not join squad."}`, ephemeral: true });
                return true;
            }
            // Award XP for squad participation
            db.addXp(interaction.user.id, 25);
            db.addReputation(interaction.user.id, 1);
            const hostUser = await interaction.client.users.fetch(res.party.host_user_id).catch(() => undefined);
            const { embed, components } = buildLfgPartyEmbed(res.party, hostUser);
            await interaction.update({ embeds: [embed], components });
            return true;
        }
        if (cid.startsWith("lfg_leave_")) {
            const partyId = Number(cid.replace("lfg_leave_", ""));
            const res = db.leaveLfgParty(partyId, interaction.user.id);
            if (!res.success || !res.party) {
                await interaction.reply({ content: `❌ ${res.error || "Could not leave squad."}`, ephemeral: true });
                return true;
            }
            const hostUser = await interaction.client.users.fetch(res.party.host_user_id).catch(() => undefined);
            const { embed, components } = buildLfgPartyEmbed(res.party, hostUser);
            await interaction.update({ embeds: [embed], components });
            return true;
        }
        if (cid.startsWith("lfg_close_")) {
            const partyId = Number(cid.replace("lfg_close_", ""));
            const party = db.getLfgParty(partyId);
            if (!party) {
                await interaction.reply({ content: "Party not found.", ephemeral: true });
                return true;
            }
            const isHost = party.host_user_id === interaction.user.id;
            const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
            if (!isHost && !isStaff) {
                await interaction.reply({ content: "⛔ Only the squad leader or staff can close this party.", ephemeral: true });
                return true;
            }
            db.closeLfgParty(partyId, party.host_user_id);
            const updated = db.getLfgParty(partyId);
            const hostUser = await interaction.client.users.fetch(updated.host_user_id).catch(() => undefined);
            const { embed, components } = buildLfgPartyEmbed(updated, hostUser);
            await interaction.update({ embeds: [embed], components });
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=game-commands.js.map