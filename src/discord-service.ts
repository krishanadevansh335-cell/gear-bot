import {
  Client,
  GatewayIntentBits,
  Guild,
  ChannelType,
  PermissionsBitField,
  PermissionResolvable,
  ColorResolvable,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  GuildChannel
} from "discord.js";
import { AppConfig, validateDiscordConfig } from "./config.js";

// Safety check: Disallowed administrative permissions to prevent automatic privilege escalation
const FORBIDDEN_AUTO_PERMISSIONS = [
  PermissionsBitField.Flags.Administrator
];

export class DiscordService {
  private client: Client;
  private config: AppConfig;
  private isReady: boolean = false;

  constructor(config: AppConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
      ]
    });
  }

  public async connect(): Promise<void> {
    const validation = validateDiscordConfig(this.config);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return new Promise((resolve, reject) => {
      this.client.once("clientReady", () => {
        this.isReady = true;
        resolve();
      });

      this.client.once("error", (err) => {
        reject(err);
      });

      this.client.login(this.config.discordToken).catch((err) => {
        reject(new Error(`Failed to login to Discord: ${err.message}`));
      });
    });
  }

  public getGuild(): Guild {
    if (!this.isReady || !this.client.user) {
      throw new Error("Discord client is not ready. Please verify bot connection.");
    }
    const guild = this.client.guilds.cache.get(this.config.guildId);
    if (!guild) {
      throw new Error(
        `Guild with ID ${this.config.guildId} not found or bot does not have access. Please verify DISCORD_GUILD_ID and ensure the bot is invited.`
      );
    }
    return guild;
  }

  public async getServerInfo(): Promise<any> {
    const guild = this.getGuild();
    // Fetch latest details
    await guild.fetch();
    return {
      id: guild.id,
      name: guild.name,
      description: guild.description || "None",
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      rolesCount: guild.roles.cache.size,
      channelsCount: guild.channels.cache.size,
      afkTimeout: guild.afkTimeout,
      verificationLevel: guild.verificationLevel,
      explicitContentFilter: guild.explicitContentFilter
    };
  }

  public async listServerStructure(): Promise<any> {
    const guild = this.getGuild();
    await guild.channels.fetch();
    await guild.roles.fetch();

    const categories: any[] = [];
    const uncategorizedChannels: any[] = [];

    const categoryChannels = guild.channels.cache.filter((c) => c?.type === ChannelType.GuildCategory);

    categoryChannels.forEach((cat) => {
      const children = guild.channels.cache
        .filter((c) => c?.parentId === cat.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: ChannelType[c.type] || c.type,
          position: "position" in c ? (c as any).position : 0
        }))
        .sort((a, b) => a.position - b.position);

      categories.push({
        id: cat.id,
        name: cat.name,
        position: "position" in cat ? (cat as any).position : 0,
        channels: children
      });
    });

    categories.sort((a, b) => a.position - b.position);

    guild.channels.cache
      .filter((c) => !c.parentId && c.type !== ChannelType.GuildCategory)
      .forEach((c) => {
        uncategorizedChannels.push({
          id: c.id,
          name: c.name,
          type: ChannelType[c.type] || c.type,
          position: "position" in c ? (c as any).position : 0
        });
      });

    uncategorizedChannels.sort((a, b) => a.position - b.position);

    const roles = guild.roles.cache
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        hoist: r.hoist,
        position: r.position,
        permissions: r.permissions.toArray()
      }))
      .sort((a, b) => b.position - a.position);

    return {
      guildId: guild.id,
      guildName: guild.name,
      categories,
      uncategorizedChannels,
      roles
    };
  }

  public async createCategory(name: string): Promise<any> {
    const guild = this.getGuild();
    // Check duplicate
    const existing = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      return {
        success: false,
        message: `Category '${name}' already exists with ID ${existing.id}. Duplicate creation prevented.`,
        category: { id: existing.id, name: existing.name }
      };
    }

    const category = await guild.channels.create({
      name: name.trim(),
      type: ChannelType.GuildCategory
    });

    return {
      success: true,
      message: `Category '${category.name}' created successfully.`,
      category: { id: category.id, name: category.name }
    };
  }

  public async createTextChannel(name: string, categoryId?: string, topic?: string): Promise<any> {
    const guild = this.getGuild();
    const formattedName = name.trim().toLowerCase().replace(/\s+/g, "-");

    // Check duplicate under the same category or globally if uncategorized
    const existing = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildText &&
        c.name.toLowerCase() === formattedName &&
        (!categoryId || c.parentId === categoryId)
    );

    if (existing) {
      return {
        success: false,
        message: `Text channel '#${formattedName}' already exists ${categoryId ? `in category ID ${categoryId}` : "at root"} (ID: ${existing.id}). Duplicate creation prevented.`,
        channel: { id: existing.id, name: existing.name, parentId: existing.parentId }
      };
    }

    const channel = await guild.channels.create({
      name: formattedName,
      type: ChannelType.GuildText,
      parent: categoryId || undefined,
      topic: topic || undefined
    });

    return {
      success: true,
      message: `Text channel '#${channel.name}' created successfully.`,
      channel: { id: channel.id, name: channel.name, parentId: channel.parentId }
    };
  }

  public async createVoiceChannel(name: string, categoryId?: string, userLimit?: number): Promise<any> {
    const guild = this.getGuild();
    const cleanName = name.trim();

    const existing = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildVoice &&
        c.name.toLowerCase() === cleanName.toLowerCase() &&
        (!categoryId || c.parentId === categoryId)
    );

    if (existing) {
      return {
        success: false,
        message: `Voice channel '${cleanName}' already exists ${categoryId ? `in category ID ${categoryId}` : "at root"} (ID: ${existing.id}). Duplicate creation prevented.`,
        channel: { id: existing.id, name: existing.name, parentId: existing.parentId }
      };
    }

    const channel = await guild.channels.create({
      name: cleanName,
      type: ChannelType.GuildVoice,
      parent: categoryId || undefined,
      userLimit: userLimit && userLimit > 0 ? userLimit : undefined
    });

    return {
      success: true,
      message: `Voice channel '${channel.name}' created successfully.`,
      channel: { id: channel.id, name: channel.name, parentId: channel.parentId }
    };
  }

  public async createRole(params: {
    name: string;
    color?: string;
    hoist?: boolean;
    mentionable?: boolean;
    permissions?: string[];
  }): Promise<any> {
    const guild = this.getGuild();
    const cleanName = params.name.trim();

    const existing = guild.roles.cache.find((r) => r.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      return {
        success: false,
        message: `Role '${cleanName}' already exists with ID ${existing.id}. Duplicate creation prevented.`,
        role: { id: existing.id, name: existing.name }
      };
    }

    // Safety: filter out Administrator permission
    let resolvedPermissions: bigint | undefined = undefined;
    if (params.permissions && params.permissions.length > 0) {
      const safePerms = params.permissions.filter(
        (p) => p !== "Administrator" && p !== "ADMINISTRATOR"
      );
      if (params.permissions.length !== safePerms.length) {
        // Administrator was attempted
        // Log safety rule enforcement
        console.warn(`[Security Alert] Creation of role '${cleanName}' attempted to include 'Administrator' permission. Blocked automatically.`);
      }
      resolvedPermissions = safePerms.reduce((acc, permName) => {
        const flag = (PermissionsBitField.Flags as any)[permName];
        return flag ? acc | flag : acc;
      }, 0n);
    }

    const role = await guild.roles.create({
      name: cleanName,
      colors: params.color ? { primaryColor: params.color as ColorResolvable } : undefined,
      hoist: params.hoist ?? false,
      mentionable: params.mentionable ?? false,
      permissions: resolvedPermissions
    });

    return {
      success: true,
      message: `Role '${role.name}' created successfully.`,
      role: {
        id: role.id,
        name: role.name,
        color: role.hexColor,
        hoist: role.hoist,
        permissions: role.permissions.toArray()
      }
    };
  }

  public async setChannelPermissions(params: {
    channelId: string;
    targetId: string; // role ID or member ID or "everyone"
    allow?: string[];
    deny?: string[];
  }): Promise<any> {
    const guild = this.getGuild();
    const channel = guild.channels.cache.get(params.channelId) as GuildChannel | undefined;

    if (!channel) {
      throw new Error(`Channel with ID ${params.channelId} not found in guild.`);
    }

    let targetId = params.targetId;
    if (targetId.toLowerCase() === "everyone" || targetId === "@everyone") {
      targetId = guild.roles.everyone.id;
    }

    // Convert string permission names to PermissionResolvable
    const allowPerms = (params.allow || [])
      .filter((p) => p !== "Administrator")
      .map((p) => (PermissionsBitField.Flags as any)[p])
      .filter(Boolean);

    const denyPerms = (params.deny || [])
      .filter((p) => p !== "Administrator")
      .map((p) => (PermissionsBitField.Flags as any)[p])
      .filter(Boolean);

    const permissionOverwrites: Record<string, boolean | null> = {};
    allowPerms.forEach((flag) => {
      permissionOverwrites[flag] = true;
    });
    denyPerms.forEach((flag) => {
      permissionOverwrites[flag] = false;
    });

    await channel.permissionOverwrites.edit(targetId, permissionOverwrites);

    return {
      success: true,
      message: `Permissions updated for target ${targetId} on channel #${channel.name}.`,
      channelId: channel.id,
      channelName: channel.name
    };
  }

  public async sendMessage(channelId: string, content: string): Promise<any> {
    const guild = this.getGuild();
    const channel = guild.channels.cache.get(channelId);

    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found in guild.`);
    }

    if (!channel.isTextBased()) {
      throw new Error(`Channel '${channel.name}' (ID ${channelId}) is not a text channel.`);
    }

    const sent = await (channel as TextChannel).send(content);

    return {
      success: true,
      messageId: sent.id,
      channelId: channel.id,
      channelName: channel.name,
      contentPreview: content.slice(0, 100)
    };
  }

  public async renameChannel(channelId: string, newName: string): Promise<any> {
    const guild = this.getGuild();
    const channel = guild.channels.cache.get(channelId);

    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found in guild.`);
    }

    const oldName = channel.name;
    const formatted = channel.type === ChannelType.GuildText
      ? newName.trim().toLowerCase().replace(/\s+/g, "-")
      : newName.trim();

    await channel.setName(formatted);

    return {
      success: true,
      message: `Channel '${oldName}' renamed to '${formatted}'.`,
      channelId: channel.id,
      newName: formatted
    };
  }

  public async deleteChannel(channelId: string, confirmation: boolean): Promise<any> {
    if (!confirmation) {
      return {
        success: false,
        message: "Destructive operation prevented: You must pass 'confirmation: true' to delete a channel."
      };
    }

    const guild = this.getGuild();
    const channel = guild.channels.cache.get(channelId);

    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found in guild.`);
    }

    const name = channel.name;
    const type = ChannelType[channel.type];
    await channel.delete();

    return {
      success: true,
      message: `Deleted ${type} channel '${name}' (ID: ${channelId}) permanently.`
    };
  }

  public async deleteRole(roleId: string, confirmation: boolean): Promise<any> {
    if (!confirmation) {
      return {
        success: false,
        message: "Destructive operation prevented: You must pass 'confirmation: true' to delete a role."
      };
    }

    const guild = this.getGuild();
    const role = guild.roles.cache.get(roleId);

    if (!role) {
      throw new Error(`Role with ID ${roleId} not found in guild.`);
    }

    if (role.name === "@everyone") {
      throw new Error("Cannot delete the @everyone role.");
    }

    if (role.managed) {
      throw new Error(`Role '${role.name}' is managed by an integration/bot and cannot be manually deleted.`);
    }

    const name = role.name;
    await role.delete();

    return {
      success: true,
      message: `Deleted role '${name}' (ID: ${roleId}) permanently.`
    };
  }

  public async applyServerTemplate(template: any, previewOnly: boolean = false): Promise<any> {
    const guild = this.getGuild();
    await guild.channels.fetch();
    await guild.roles.fetch();

    const plannedChanges: {
      rolesToCreate: string[];
      categoriesToCreate: string[];
      channelsToCreate: { name: string; type: string; category: string }[];
    } = {
      rolesToCreate: [],
      categoriesToCreate: [],
      channelsToCreate: []
    };

    // 1. Analyze Roles
    const rolesList = template.roles || [];
    for (const r of rolesList) {
      const exists = guild.roles.cache.some((existing) => existing.name.toLowerCase() === r.name.toLowerCase());
      if (!exists) {
        plannedChanges.rolesToCreate.push(r.name);
      }
    }

    // 2. Analyze Categories & Channels
    const categoriesList = template.categories || [];
    for (const cat of categoriesList) {
      const catExists = guild.channels.cache.some(
        (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === cat.name.toLowerCase()
      );
      if (!catExists) {
        plannedChanges.categoriesToCreate.push(cat.name);
      }

      for (const ch of cat.channels || []) {
        plannedChanges.channelsToCreate.push({
          name: ch.name,
          type: ch.type,
          category: cat.name
        });
      }
    }

    if (previewOnly) {
      return {
        preview: true,
        summary: `Template preview: ${plannedChanges.rolesToCreate.length} roles to create, ${plannedChanges.categoriesToCreate.length} categories to create, and ${plannedChanges.channelsToCreate.length} channels configured.`,
        plannedChanges
      };
    }

    // Execution phase
    const results: {
      rolesCreated: string[];
      categoriesCreated: string[];
      channelsCreated: string[];
      permissionsApplied: string[];
      errors: string[];
    } = {
      rolesCreated: [],
      categoriesCreated: [],
      channelsCreated: [],
      permissionsApplied: [],
      errors: []
    };

    // Create Roles
    const roleMap = new Map<string, string>(); // name -> id
    guild.roles.cache.forEach((r) => roleMap.set(r.name.toLowerCase(), r.id));

    for (const r of rolesList) {
      try {
        if (!roleMap.has(r.name.toLowerCase())) {
          const res = await this.createRole({
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            mentionable: r.mentionable,
            permissions: r.permissions
          });
          if (res.success && res.role) {
            results.rolesCreated.push(res.role.name);
            roleMap.set(r.name.toLowerCase(), res.role.id);
          }
        }
      } catch (err: any) {
        results.errors.push(`Role '${r.name}' error: ${err.message}`);
      }
    }

    // Refresh roles cache
    await guild.roles.fetch();

    // Create Categories and Channels
    for (const cat of categoriesList) {
      let categoryId: string | undefined;
      const existingCat = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === cat.name.toLowerCase()
      );

      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        try {
          const catRes = await this.createCategory(cat.name);
          if (catRes.success) {
            results.categoriesCreated.push(cat.name);
            categoryId = catRes.category.id;
          }
        } catch (err: any) {
          results.errors.push(`Category '${cat.name}' error: ${err.message}`);
        }
      }

      // Category level permissions
      if (categoryId && cat.permissionOverwrites) {
        for (const ow of cat.permissionOverwrites) {
          try {
            let targetId = ow.role;
            if (targetId === "@everyone") {
              targetId = guild.roles.everyone.id;
            } else {
              const r = guild.roles.cache.find((role) => role.name.toLowerCase() === targetId.toLowerCase());
              if (r) targetId = r.id;
            }
            await this.setChannelPermissions({
              channelId: categoryId,
              targetId: targetId,
              allow: ow.allow,
              deny: ow.deny
            });
            results.permissionsApplied.push(`Applied category permissions for '${ow.role}' on '${cat.name}'`);
          } catch (err: any) {
            results.errors.push(`Category permission error for '${ow.role}' on '${cat.name}': ${err.message}`);
          }
        }
      }

      // Channels in Category
      for (const ch of cat.channels || []) {
        try {
          let channelRes;
          if (ch.type === "voice") {
            channelRes = await this.createVoiceChannel(ch.name, categoryId, ch.userLimit);
          } else {
            channelRes = await this.createTextChannel(ch.name, categoryId, ch.topic);
          }

          if (channelRes.success) {
            results.channelsCreated.push(`${ch.type}: ${ch.name}`);
            const createdChannelId = channelRes.channel.id;

            // Specific channel permission overwrites
            if (ch.permissionOverwrites && createdChannelId) {
              for (const ow of ch.permissionOverwrites) {
                let targetId = ow.role;
                if (targetId === "@everyone") {
                  targetId = guild.roles.everyone.id;
                } else {
                  const r = guild.roles.cache.find((role) => role.name.toLowerCase() === targetId.toLowerCase());
                  if (r) targetId = r.id;
                }
                await this.setChannelPermissions({
                  channelId: createdChannelId,
                  targetId: targetId,
                  allow: ow.allow,
                  deny: ow.deny
                });
                results.permissionsApplied.push(`Channel permission applied for '${ow.role}' on '#${ch.name}'`);
              }
            }

            // Initial greeting / message
            if (ch.initialMessage && ch.type === "text" && createdChannelId) {
              await this.sendMessage(createdChannelId, ch.initialMessage);
            }
          }
        } catch (err: any) {
          results.errors.push(`Channel '${ch.name}' error: ${err.message}`);
        }
      }
    }

    return {
      success: true,
      summary: `Template applied: ${results.rolesCreated.length} roles created, ${results.categoriesCreated.length} categories created, ${results.channelsCreated.length} channels created.`,
      details: results
    };
  }

  public isClientReady(): boolean {
    return this.isReady;
  }
}
