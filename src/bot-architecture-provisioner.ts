import {
  Guild,
  ChannelType,
  PermissionFlagsBits,
  CategoryChannel,
  TextChannel,
  VoiceChannel,
  Role,
  GuildMember
} from "discord.js";

export interface BotRemediationResult {
  botName: string;
  roleId: string;
  roleName: string;
  position: number;
  success: boolean;
  action: "revoked" | "manual_required" | "unchanged";
  notes: string;
}

export interface ChannelProvisioningAction {
  action: "create" | "rename" | "reparent" | "verified";
  type: "category" | "text" | "voice";
  name: string;
  id?: string;
  categoryName?: string;
  notes?: string;
}

export interface BotOverwriteAction {
  channelName: string;
  botName: string;
  botId: string;
  allowedPerms: string[];
  success: boolean;
  notes?: string;
}

export interface ArchitectureExecutionReport {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  botRemediations: BotRemediationResult[];
  channelActions: ChannelProvisioningAction[];
  botOverwrites: BotOverwriteAction[];
  manualActions: string[];
}

export class BotArchitectureProvisioner {
  private guild: Guild;

  constructor(guild: Guild) {
    this.guild = guild;
  }

  /**
   * Batch 1: Revoke guild-wide Administrator from third-party bots where hierarchy allows
   */
  public async remediateBotAdministratorRoles(previewOnly: boolean = false): Promise<BotRemediationResult[]> {
    await this.guild.roles.fetch();
    try {
      await this.guild.members.fetch();
    } catch {
      await this.guild.members.fetch({ limit: 100 }).catch(() => {});
    }
    const me = await this.guild.members.fetchMe();
    const botHighestPos = me.roles.highest.position;

    const results: BotRemediationResult[] = [];
    const botsToAudit = [
      "Invite+",
      "Wick",
      "APAR",
      "Falcon™",
      "Xenon",
      "Sapphire",
      "Vetox",
      "Modora"
    ];

    for (const botName of botsToAudit) {
      const member = this.guild.members.cache.find(
        (m) => m.displayName.toLowerCase().includes(botName.toLowerCase()) || m.user.username.toLowerCase().includes(botName.toLowerCase())
      );
      if (!member) continue;

      const managedRole = member.roles.cache.find((r) => r.managed) || member.roles.highest;
      const hasAdmin = managedRole.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasAdmin) {
        results.push({
          botName: member.displayName,
          roleId: managedRole.id,
          roleName: managedRole.name,
          position: managedRole.position,
          success: true,
          action: "unchanged",
          notes: "Administrator permission already revoked or not present"
        });
        continue;
      }

      if (managedRole.position >= botHighestPos) {
        results.push({
          botName: member.displayName,
          roleId: managedRole.id,
          roleName: managedRole.name,
          position: managedRole.position,
          success: false,
          action: "manual_required",
          notes: `Role position (${managedRole.position}) is >= Gamer Gear (${botHighestPos}). Server Owner must move Gamer Gear above this role or manually toggle off Administrator.`
        });
        continue;
      }

      // Can edit via API
      if (!previewOnly) {
        try {
          const safePerms = managedRole.permissions.remove(PermissionFlagsBits.Administrator);
          await managedRole.setPermissions(
            safePerms,
            `Least-privilege security: Revoked Administrator from ${member.displayName}`
          );
          results.push({
            botName: member.displayName,
            roleId: managedRole.id,
            roleName: managedRole.name,
            position: managedRole.position,
            success: true,
            action: "revoked",
            notes: "Administrator revoked successfully via Discord API"
          });
        } catch (err: any) {
          results.push({
            botName: member.displayName,
            roleId: managedRole.id,
            roleName: managedRole.name,
            position: managedRole.position,
            success: false,
            action: "manual_required",
            notes: `API Error: ${err.message}`
          });
        }
      } else {
        results.push({
          botName: member.displayName,
          roleId: managedRole.id,
          roleName: managedRole.name,
          position: managedRole.position,
          success: true,
          action: "revoked",
          notes: "[PREVIEW] Would revoke Administrator and set least-privilege permissions"
        });
      }
    }

    return results;
  }

  /**
   * Batch 2: Structure categories & channels cleanly, reusing existing resources
   */
  public async provisionCategoriesAndChannels(previewOnly: boolean = false): Promise<ChannelProvisioningAction[]> {
    await this.guild.channels.fetch();
    await this.guild.roles.fetch();

    const actions: ChannelProvisioningAction[] = [];
    const verifiedRole = this.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === "verified member" || r.name.toLowerCase() === "verified"
    );
    const staffRole = this.guild.roles.cache.find((r) => r.name.toLowerCase() === "staff");
    const everyoneRole = this.guild.roles.everyone;
    const me = await this.guild.members.fetchMe();

    // Helper: Find or create category
    const ensureCategory = async (name: string, overwrites: any[]): Promise<CategoryChannel> => {
      let cat = this.guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase()
      ) as CategoryChannel | undefined;

      if (!cat) {
        if (!previewOnly) {
          cat = await this.guild.channels.create({
            name,
            type: ChannelType.GuildCategory,
            permissionOverwrites: overwrites
          });
          actions.push({ action: "create", type: "category", name: cat.name, id: cat.id });
        } else {
          actions.push({ action: "create", type: "category", name: `[PREVIEW] ${name}` });
          cat = { id: `mock_cat_${name}`, name } as any;
        }
      } else {
        actions.push({ action: "verified", type: "category", name: cat.name, id: cat.id });
      }
      return cat!;
    };

    // Helper: Find, rename, re-parent or create text channel
    const ensureTextChannel = async (
      targetName: string,
      category: CategoryChannel,
      reusableExistingNames: string[],
      topic: string,
      customOverwrites?: any[]
    ): Promise<TextChannel | null> => {
      let ch = this.guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === targetName.toLowerCase()
      ) as TextChannel | undefined;

      if (!ch) {
        // Check reusable names
        for (const existingName of reusableExistingNames) {
          ch = this.guild.channels.cache.find(
            (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === existingName.toLowerCase()
          ) as TextChannel | undefined;
          if (ch) {
            if (!previewOnly) {
              const oldName = ch.name;
              await ch.edit({
                name: targetName,
                parent: category.id.startsWith("mock") ? null : category.id,
                topic
              });
              actions.push({
                action: "rename",
                type: "text",
                name: targetName,
                id: ch.id,
                categoryName: category.name,
                notes: `Renamed from #${oldName}`
              });
            } else {
              actions.push({
                action: "rename",
                type: "text",
                name: targetName,
                id: ch.id,
                categoryName: category.name,
                notes: `[PREVIEW] Would rename from #${ch.name}`
              });
            }
            return ch;
          }
        }

        // Channel does not exist anywhere -> create it
        if (!previewOnly) {
          ch = await this.guild.channels.create({
            name: targetName,
            type: ChannelType.GuildText,
            parent: category.id.startsWith("mock") ? null : category.id,
            topic,
            permissionOverwrites: customOverwrites
          });
          actions.push({
            action: "create",
            type: "text",
            name: targetName,
            id: ch.id,
            categoryName: category.name
          });
        } else {
          actions.push({
            action: "create",
            type: "text",
            name: `[PREVIEW] #${targetName}`,
            categoryName: category.name
          });
          return null;
        }
      } else {
        // Channel already exists with targetName, ensure parent
        const isMismatchedParent = category.id.startsWith("mock")
          ? ch.parent?.name.toLowerCase() !== category.name.toLowerCase()
          : ch.parentId !== category.id;

        if (isMismatchedParent) {
          if (!previewOnly) {
            await ch.setParent(category.id, { lockPermissions: false });
            actions.push({
              action: "reparent",
              type: "text",
              name: ch.name,
              id: ch.id,
              categoryName: category.name
            });
          } else {
            actions.push({
              action: "reparent",
              type: "text",
              name: ch.name,
              id: ch.id,
              categoryName: category.name,
              notes: "[PREVIEW] Would re-parent"
            });
          }
        } else {
          actions.push({ action: "verified", type: "text", name: ch.name, id: ch.id, categoryName: category.name });
        }
      }

      return ch || null;
    };

    // Helper: Find, rename, re-parent or create voice channel
    const ensureVoiceChannel = async (
      targetName: string,
      category: CategoryChannel,
      reusableExistingNames: string[]
    ): Promise<VoiceChannel | null> => {
      let vc = this.guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildVoice && c.name.toLowerCase() === targetName.toLowerCase()
      ) as VoiceChannel | undefined;

      if (!vc) {
        for (const existingName of reusableExistingNames) {
          vc = this.guild.channels.cache.find(
            (c) => c.type === ChannelType.GuildVoice && c.name.toLowerCase() === existingName.toLowerCase()
          ) as VoiceChannel | undefined;
          if (vc) {
            if (!previewOnly) {
              const oldName = vc.name;
              await vc.edit({
                name: targetName,
                parent: category.id.startsWith("mock") ? null : category.id
              });
              actions.push({
                action: "rename",
                type: "voice",
                name: targetName,
                id: vc.id,
                categoryName: category.name,
                notes: `Renamed from ${oldName}`
              });
            } else {
              actions.push({
                action: "rename",
                type: "voice",
                name: targetName,
                id: vc.id,
                categoryName: category.name,
                notes: `[PREVIEW] Would rename from ${vc.name}`
              });
            }
            return vc;
          }
        }

        if (!previewOnly) {
          vc = await this.guild.channels.create({
            name: targetName,
            type: ChannelType.GuildVoice,
            parent: category.id.startsWith("mock") ? null : category.id
          });
          actions.push({ action: "create", type: "voice", name: targetName, id: vc.id, categoryName: category.name });
        } else {
          actions.push({ action: "create", type: "voice", name: `[PREVIEW] ${targetName}`, categoryName: category.name });
          return null;
        }
      } else {
        if (vc.parentId !== category.id && !category.id.startsWith("mock")) {
          if (!previewOnly) {
            await vc.setParent(category.id, { lockPermissions: false });
            actions.push({ action: "reparent", type: "voice", name: vc.name, id: vc.id, categoryName: category.name });
          } else {
            actions.push({
              action: "reparent",
              type: "voice",
              name: vc.name,
              id: vc.id,
              categoryName: category.name,
              notes: "[PREVIEW] Would re-parent"
            });
          }
        } else {
          actions.push({ action: "verified", type: "voice", name: vc.name, id: vc.id, categoryName: category.name });
        }
      }

      return vc || null;
    };

    // 1. INFORMATION Category
    const infoCat = await ensureCategory("INFORMATION", [
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
      { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }
    ]);
    await ensureTextChannel("welcome", infoCat, ["welcome"], "Welcome to GAMING SHAMING! Greeting card and new member introductions.");
    await ensureTextChannel("announcements", infoCat, ["announcements"], "Official community announcements and scheduled events.");
    await ensureTextChannel("server-updates", infoCat, ["server-updates"], "Server changelog and automated backup logs.");
    await ensureTextChannel("choose-roles", infoCat, ["pick-roles", "choose-roles"], "Self-service game and platform button roles powered by Zira.");

    // 2. COMMUNITY Category
    const commCat = await ensureCategory("COMMUNITY", [
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
      { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...(verifiedRole ? [{ id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
    ]);
    await ensureTextChannel("general-chat", commCat, ["🌟general", "general"], "General community conversation.");
    await ensureTextChannel("level-ups", commCat, ["level-up", "level-ups"], "Rank and XP milestones powered by Arcane.");
    await ensureTextChannel("memes", commCat, ["memes"], "Gaming memes and humor.");
    await ensureTextChannel("suggestions", commCat, ["suggestions"], "Member ideas and feedback for the server.");

    // 3. GAMING Category
    const gameCat = await ensureCategory("GAMING", [
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
      { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...(verifiedRole ? [{ id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
    ]);
    await ensureTextChannel("looking-for-group", gameCat, ["looking-for-group"], "General multiplayer team coordination and match alerts.");
    await ensureTextChannel("gaming-events", gameCat, ["gaming-events"], "Tournaments, raids, and community game nights.");
    await ensureTextChannel("game-news", gameCat, ["game-news"], "Steam patch notes, release announcements, and gaming news.");
    await ensureTextChannel("game-requests", gameCat, ["game-requests"], "Request dynamic channels for new community games.");
    await ensureTextChannel("game-bots", gameCat, ["game-bots"], "Gaming utility bots and stat lookup commands.");

    // 4. VOICE Category
    const voiceCat = await ensureCategory("VOICE", [
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
      { id: everyoneRole.id, deny: [PermissionFlagsBits.Connect] },
      ...(verifiedRole ? [{ id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : []),
      ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : [])
    ]);
    await ensureVoiceChannel("🔊 Gaming Lounge", voiceCat, ["Gaming Lounge"]);
    await ensureVoiceChannel("🔊 Competitive", voiceCat, ["Competitive"]);
    await ensureVoiceChannel("🔊 Casual Gaming", voiceCat, ["Casual Gaming"]);
    await ensureVoiceChannel("🔊 Music Room", voiceCat, ["Jockie Music Vc", "Music Room"]);

    // 5. BOT COMMANDS Category
    const cmdCat = await ensureCategory("BOT COMMANDS", [
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
      { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...(verifiedRole ? [{ id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
    ]);
    await ensureTextChannel("bot-commands", cmdCat, ["bot-commands"], "Public bot interactions and entertainment commands.");
    await ensureTextChannel("music-commands", cmdCat, ["jockie-commands", "music-commands"], "Music player commands powered by Jockie Music.");
    await ensureTextChannel("lfg-commands", cmdCat, ["lfg-commands"], "Matchmaking commands powered by ezLFG.");

    // 6. STAFF & LOGS Category
    const staffCat = await ensureCategory("STAFF & LOGS", [
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
      { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
    ]);
    await ensureTextChannel("mod-logs", staffCat, ["mod-logs"], "Moderation logs and administrative audit trail.");
    await ensureTextChannel("member-logs", staffCat, ["member-logs"], "Member joins, leaves, and activity metrics.");
    await ensureTextChannel("bot-logs", staffCat, ["bot-logs"], "Diagnostic logs and external bot event stream.");
    await ensureTextChannel("ticket-support", staffCat, ["ticket-support"], "Private member assistance tickets and staff inquiries.");

    return actions;
  }

  /**
   * Batch 3: Apply least-privilege channel overwrites for designated bots
   */
  public async configureBotChannelOverwrites(previewOnly: boolean = false): Promise<BotOverwriteAction[]> {
    await this.guild.channels.fetch();
    try {
      await this.guild.members.fetch();
    } catch {
      await this.guild.members.fetch({ limit: 100 }).catch(() => {});
    }

    const actions: BotOverwriteAction[] = [];
    const textPerms = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.AddReactions
    ];

    const voicePerms = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.UseVAD
    ];

    const assignments: Array<{
      channelName: string;
      botName: string;
      isVoice?: boolean;
    }> = [
      // INFORMATION
      { channelName: "welcome", botName: "Ayako" },
      { channelName: "announcements", botName: "Apollo" },
      { channelName: "server-updates", botName: "Xenon" },
      { channelName: "choose-roles", botName: "Zira" },

      // COMMUNITY
      { channelName: "general-chat", botName: "Dank Memer" },
      { channelName: "general-chat", botName: "MEE6" },
      { channelName: "level-ups", botName: "Arcane" },
      { channelName: "memes", botName: "Dank Memer" },
      { channelName: "suggestions", botName: "Sapphire" },

      // GAMING
      { channelName: "looking-for-group", botName: "ezLFG" },
      { channelName: "gaming-events", botName: "Apollo" },
      { channelName: "gaming-events", botName: "sesh" },
      { channelName: "game-news", botName: "SteamDB" },
      { channelName: "game-bots", botName: "Falcon™" },
      { channelName: "game-bots", botName: "Vetox" },

      // VOICE
      { channelName: "🔊 Music Room", botName: "Jockie Music", isVoice: true },

      // BOT COMMANDS
      { channelName: "bot-commands", botName: "Dank Memer" },
      { channelName: "bot-commands", botName: "MEE6" },
      { channelName: "bot-commands", botName: "Arcane" },
      { channelName: "bot-commands", botName: "Sapphire" },
      { channelName: "bot-commands", botName: "WabbitBot" },
      { channelName: "music-commands", botName: "Jockie Music" },
      { channelName: "lfg-commands", botName: "ezLFG" },

      // STAFF & LOGS
      { channelName: "mod-logs", botName: "Wick" },
      { channelName: "mod-logs", botName: "carl-bot" },
      { channelName: "member-logs", botName: "Lurkr" },
      { channelName: "member-logs", botName: "Invite+" },
      { channelName: "bot-logs", botName: "APAR" },
      { channelName: "mod-alerts", botName: "Wick" },
      { channelName: "mod-alerts", botName: "Sapphire" }
    ];

    for (const item of assignments) {
      let channel = this.guild.channels.cache.find((c) => c.name.toLowerCase() === item.channelName.toLowerCase());
      if (!channel) {
        if (previewOnly) {
          const member = this.guild.members.cache.find(
            (m) => m.displayName.toLowerCase().includes(item.botName.toLowerCase()) || m.user.username.toLowerCase().includes(item.botName.toLowerCase())
          );
          if (member) {
            const permNames = item.isVoice ? ["ViewChannel", "Connect", "Speak"] : ["ViewChannel", "SendMessages", "ReadMessageHistory", "EmbedLinks"];
            actions.push({
              channelName: item.channelName,
              botName: member.displayName,
              botId: member.id,
              allowedPerms: permNames,
              success: true,
              notes: "[PREVIEW] Would grant channel-specific least-privilege overwrite (after channel is provisioned)"
            });
            continue;
          }
        }

        actions.push({
          channelName: item.channelName,
          botName: item.botName,
          botId: "MISSING",
          allowedPerms: [],
          success: false,
          notes: `Channel #${item.channelName} not found`
        });
        continue;
      }

      const member = this.guild.members.cache.find(
        (m) => m.displayName.toLowerCase().includes(item.botName.toLowerCase()) || m.user.username.toLowerCase().includes(item.botName.toLowerCase())
      );
      if (!member) {
        actions.push({
          channelName: item.channelName,
          botName: item.botName,
          botId: "MISSING",
          allowedPerms: [],
          success: false,
          notes: `Bot ${item.botName} not found on server`
        });
        continue;
      }

      const permsToAllow = item.isVoice ? voicePerms : textPerms;
      const permNames = item.isVoice ? ["ViewChannel", "Connect", "Speak"] : ["ViewChannel", "SendMessages", "ReadMessageHistory", "EmbedLinks"];

      if (!previewOnly) {
        try {
          await (channel as any).permissionOverwrites.create(member.id, {
            ViewChannel: true,
            ...(item.isVoice
              ? { Connect: true, Speak: true, UseVAD: true }
              : { SendMessages: true, ReadMessageHistory: true, EmbedLinks: true, AttachFiles: true })
          });
          actions.push({
            channelName: channel.name,
            botName: member.displayName,
            botId: member.id,
            allowedPerms: permNames,
            success: true,
            notes: "Overwrite applied successfully"
          });
        } catch (err: any) {
          actions.push({
            channelName: channel.name,
            botName: member.displayName,
            botId: member.id,
            allowedPerms: permNames,
            success: false,
            notes: `Error: ${err.message}`
          });
        }
      } else {
        actions.push({
          channelName: channel.name,
          botName: member.displayName,
          botId: member.id,
          allowedPerms: permNames,
          success: true,
          notes: "[PREVIEW] Would grant channel-specific least-privilege overwrite"
        });
      }
    }

    return actions;
  }
}
