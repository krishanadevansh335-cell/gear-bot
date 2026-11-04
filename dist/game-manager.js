import { ChannelType, PermissionFlagsBits } from "discord.js";
import { GameDatabase } from "./game-db.js";
export class DynamicGameManager {
    guild;
    db;
    constructor(guild, db) {
        this.guild = guild;
        this.db = db || new GameDatabase();
        this.db.seedCategoriesAndGames();
    }
    getDatabase() {
        return this.db;
    }
    /**
     * Ensures the 6 game categories exist in the server.
     * Permissions: Visible to Verified members, but hidden from @everyone unverified.
     */
    async ensureGameCategories() {
        await this.guild.channels.fetch();
        await this.guild.roles.fetch();
        const me = await this.guild.members.fetchMe();
        const everyone = this.guild.roles.everyone;
        const verifiedRole = this.guild.roles.cache.find((r) => r.name.toLowerCase() === "verified member" || r.name.toLowerCase() === "verified");
        const categories = this.db.getAllCategories();
        const categoryMap = new Map();
        for (const cat of categories) {
            let existing = this.guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === cat.name.toLowerCase());
            if (!existing) {
                existing = await this.guild.channels.create({
                    name: cat.name,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: me.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                        },
                        {
                            id: everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        ...(verifiedRole
                            ? [
                                {
                                    id: verifiedRole.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                                }
                            ]
                            : [])
                    ]
                });
            }
            this.db.updateCategoryDiscordId(cat.id, existing.id);
            categoryMap.set(cat.id, existing);
        }
        return categoryMap;
    }
    /**
     * Idempotently creates a game role, text channel, and voice channel on demand.
     * Only called when members select the game or moderators approve a request.
     */
    async provisionGameResources(slugOrName, options = {}) {
        const game = this.db.getGameBySlug(slugOrName);
        if (!game) {
            throw new Error(`Game '${slugOrName}' not found in gaming directory.`);
        }
        await this.guild.channels.fetch();
        await this.guild.roles.fetch();
        const me = await this.guild.members.fetchMe();
        const categoriesMap = await this.ensureGameCategories();
        const targetCategory = categoriesMap.get(game.category_id);
        if (!targetCategory) {
            throw new Error(`Category ID '${game.category_id}' could not be resolved.`);
        }
        // Check category channel limits
        const currentChildren = this.guild.channels.cache.filter((c) => c.parentId === targetCategory.id).size;
        const catConfig = this.db.getCategory(game.category_id);
        const maxChannels = catConfig ? catConfig.max_channels : 20;
        if (currentChildren >= maxChannels) {
            throw new Error(`Category '${targetCategory.name}' has reached its channel limit (${currentChildren}/${maxChannels}). Cannot create more game channels in this category.`);
        }
        let createdRole = false;
        let createdText = false;
        let createdVoice = false;
        // 1. Role Provisioning
        let role = this.guild.roles.cache.find((r) => r.name.toLowerCase() === game.role_name.toLowerCase());
        if (!role) {
            role = await this.guild.roles.create({
                name: game.role_name,
                colors: { primaryColor: game.role_color },
                hoist: false,
                mentionable: true,
                permissions: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.Speak
                ]
            });
            createdRole = true;
        }
        // 2. Text Channel Provisioning (#<slug>)
        const channelName = game.slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
        let textChannel = this.guild.channels.cache.find((c) => c.name.toLowerCase() === channelName && c.parentId === targetCategory.id && c.type === ChannelType.GuildText);
        if (!textChannel) {
            textChannel = await this.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: targetCategory.id,
                topic: `General chat and discussion for ${game.name}. Role: @${role.name}`
            });
            createdText = true;
        }
        // 3. Voice Channel Provisioning (Optional / Default true if requested)
        let voiceChannelId = game.voice_channel_id;
        if (options.createVoice) {
            const voiceName = `${game.name} VC`;
            let voiceChannel = this.guild.channels.cache.find((c) => c.name.toLowerCase() === voiceName.toLowerCase() && c.parentId === targetCategory.id && c.type === ChannelType.GuildVoice);
            if (!voiceChannel) {
                voiceChannel = await this.guild.channels.create({
                    name: voiceName,
                    type: ChannelType.GuildVoice,
                    parent: targetCategory.id
                });
                createdVoice = true;
            }
            voiceChannelId = voiceChannel.id;
        }
        // Update database mapping
        this.db.updateGameDiscordResources(game.slug, {
            text_channel_id: textChannel.id,
            voice_channel_id: voiceChannelId,
            role_id: role.id
        });
        this.db.logAudit("PROVISION_GAME", `Provisioned game '${game.name}' (Text: #${textChannel.name}, Role: @${role.name})`);
        return {
            game: this.db.getGameBySlug(game.slug),
            createdText,
            createdVoice,
            createdRole,
            categoryName: targetCategory.name
        };
    }
    /**
     * Registers a user's selection of a game, assigns the game role,
     * dynamically provisions the channel if this is the first interested player,
     * and preserves minor/adult separation.
     */
    async addMemberToGame(userId, gameSlug, platform, skill) {
        const game = this.db.getGameBySlug(gameSlug);
        if (!game) {
            throw new Error(`Game '${gameSlug}' not found.`);
        }
        // Record profile in SQLite
        this.db.recordMemberGame(userId, game.slug, platform, skill);
        // Provision game resources on-demand (channels & role)
        const prov = await this.provisionGameResources(game.slug, { createVoice: true });
        // Assign Role to member
        const member = await this.guild.members.fetch(userId);
        const role = this.guild.roles.cache.find((r) => r.name.toLowerCase() === game.role_name.toLowerCase());
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }
        this.db.logAudit("MEMBER_GAME_JOIN", `User ${member.user.tag} joined ${game.name} (${platform}, ${skill})`, userId);
        return {
            success: true,
            message: `Assigned role '${role?.name}' and provisioned #${prov.game.slug}.`,
            roleAdded: role?.name || game.role_name
        };
    }
}
//# sourceMappingURL=game-manager.js.map