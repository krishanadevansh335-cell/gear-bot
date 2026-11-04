import {
  ChannelType,
  Guild,
  PermissionFlagsBits,
  PermissionsBitField,
  Role,
  CategoryChannel,
  GuildChannel,
  ColorResolvable
} from "discord.js";
import { DiscordService } from "./discord-service.js";
import { ONBOARDING_MAPPING_RULES } from "./onboarding-roles.js";

export type ProvisioningStatus = "FULL SUCCESS" | "PARTIAL SUCCESS" | "FAILED";

export interface PermissionPreflight {
  canManageRoles: boolean;
  canManageChannels: boolean;
  canViewChannels: boolean;
  botHighestRole: { name: string; position: number };
  missingBotPermissions: string[];
}

export interface ChannelAccessAudit {
  channelName: string;
  channelId: string;
  category: string;
  access: {
    everyone: boolean;
    minor: boolean;
    adult: boolean;
    verified: boolean;
    staff: boolean;
  };
  positiveChecksPassed: boolean;
  negativeChecksPassed: boolean;
  isolationCompliant: boolean;
  isolationNotes?: string;
}

export interface ProvisioningOperationDetail {
  action: "create_role" | "rename_role" | "create_category" | "create_channel" | "set_permission";
  target: string;
  targetId?: string;
  success: boolean;
  error?: {
    code: number | string;
    message: string;
    route?: string;
  };
}

export interface StructuredProvisioningReport {
  status: ProvisioningStatus;
  summary: string;
  preflight: PermissionPreflight;
  existingResources: {
    roles: { id: string; name: string }[];
    categories: { id: string; name: string }[];
    channels: { id: string; name: string; type: string }[];
  };
  createdResources: {
    roles: string[];
    categories: string[];
    channels: string[];
  };
  successfulOverwrites: string[];
  failedOperations: ProvisioningOperationDetail[];
  accessAudit: ChannelAccessAudit[];
  requiredManualActions: string[];
}

export class DiscordProvisioner {
  private discordService: DiscordService;

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
  }

  /**
   * Performs preflight checks on the bot's permissions and role hierarchy.
   */
  public async checkPreflight(): Promise<PermissionPreflight> {
    const guild = this.discordService.getGuild();
    const me = await guild.members.fetchMe();
    const permissions = me.permissions;

    const canManageRoles = permissions.has(PermissionFlagsBits.ManageRoles);
    const canManageChannels = permissions.has(PermissionFlagsBits.ManageChannels);
    const canViewChannels = permissions.has(PermissionFlagsBits.ViewChannel);

    const missingBotPermissions: string[] = [];
    if (!canManageRoles) missingBotPermissions.push("ManageRoles");
    if (!canManageChannels) missingBotPermissions.push("ManageChannels");
    if (!canViewChannels) missingBotPermissions.push("ViewChannel");

    return {
      canManageRoles,
      canManageChannels,
      canViewChannels,
      botHighestRole: {
        name: me.roles.highest.name,
        position: me.roles.highest.position
      },
      missingBotPermissions
    };
  }

  /**
   * Idempotent Server Provisioning with preflight checks, atomic tracking, and structured reporting.
   */
  public async provisionServer(previewOnly: boolean = false): Promise<StructuredProvisioningReport> {
    const guild = this.discordService.getGuild();
    await guild.channels.fetch();
    await guild.roles.fetch();

    const preflight = await this.checkPreflight();
    const me = await guild.members.fetchMe();

    const report: StructuredProvisioningReport = {
      status: "FULL SUCCESS",
      summary: "",
      preflight,
      existingResources: {
        roles: Array.from(guild.roles.cache.values()).map((r: any) => ({ id: r.id, name: r.name })),
        categories: Array.from(guild.channels.cache.values())
          .filter((c: any) => c?.type === ChannelType.GuildCategory)
          .map((c: any) => ({ id: c.id, name: c.name })),
        channels: Array.from(guild.channels.cache.values())
          .filter((c: any) => c?.type !== ChannelType.GuildCategory)
          .map((c: any) => ({ id: c.id, name: c.name, type: ChannelType[c.type] || String(c.type) }))
      },
      createdResources: {
        roles: [],
        categories: [],
        channels: []
      },
      successfulOverwrites: [],
      failedOperations: [],
      accessAudit: [],
      requiredManualActions: []
    };

    if (preflight.missingBotPermissions.length > 0) {
      report.status = "FAILED";
      report.summary = `Provisioning aborted: Bot is missing mandatory guild permissions: ${preflight.missingBotPermissions.join(", ")}.`;
      report.requiredManualActions.push(
        `Grant ${preflight.missingBotPermissions.join(", ")} permissions to the bot role in Discord Server Settings.`
      );
      return report;
    }

    // 1. Ensure required Roles exist (using only bot-permitted permissions to avoid 50013 Missing Permissions)
    const botPerms = me.permissions;
    const safeRolePerms = (requested: string[]): string[] => {
      return requested.filter((p) => {
        if (p === "Administrator" || p === "ADMINISTRATOR") return false;
        const flag = (PermissionFlagsBits as any)[p];
        return flag ? botPerms.has(flag) : false;
      });
    };

    const requiredRolesSpec: {
      name: string;
      legacyNames?: string[];
      colors: { primaryColor: ColorResolvable };
      hoist: boolean;
      permissions: string[];
    }[] = [
      {
        name: "Verified Member",
        legacyNames: ["Verified"],
        colors: { primaryColor: "#3498DB" },
        hoist: false,
        permissions: safeRolePerms(["ViewChannel", "SendMessages", "ReadMessageHistory", "Connect", "Speak"])
      },
      {
        name: "Teen Member",
        legacyNames: ["Minor 13-17", "Minor 13–17"],
        colors: { primaryColor: "#E0A526" },
        hoist: true,
        permissions: safeRolePerms(["ViewChannel", "SendMessages", "ReadMessageHistory", "Connect", "Speak"])
      },
      {
        name: "18+ Member",
        legacyNames: ["Adult 18+"],
        colors: { primaryColor: "#2ECC71" },
        hoist: true,
        permissions: safeRolePerms(["ViewChannel", "SendMessages", "ReadMessageHistory", "Connect", "Speak"])
      },
      {
        name: "Staff",
        colors: { primaryColor: "#9B59B6" },
        hoist: true,
        permissions: safeRolePerms(["ViewChannel", "SendMessages", "ReadMessageHistory", "Connect", "Speak"])
      }
    ];

    const preferenceRolesSpec = ONBOARDING_MAPPING_RULES.map((rule) => ({
      name: rule.roleName,
      colors: { primaryColor: (rule.color || "#5865F2") as ColorResolvable },
      hoist: false,
      permissions: safeRolePerms(["ViewChannel", "SendMessages", "ReadMessageHistory"])
    }));

    const allRoleSpecs = [...requiredRolesSpec];
    for (const pref of preferenceRolesSpec) {
      if (!allRoleSpecs.some((r) => r.name.toLowerCase() === pref.name.toLowerCase())) {
        allRoleSpecs.push(pref);
      }
    }

    const roleMap: Map<string, Role> = new Map();
    guild.roles.cache.forEach((r) => roleMap.set(r.name.toLowerCase(), r));

    for (const rSpec of allRoleSpecs) {
      let existing = roleMap.get(rSpec.name.toLowerCase());
      if (!existing && (rSpec as any).legacyNames) {
        for (const legacyName of (rSpec as any).legacyNames) {
          const match = roleMap.get(legacyName.toLowerCase());
          if (match) {
            existing = match;
            if (!previewOnly) {
              try {
                console.log(`[Role Rename] Renaming existing role "${match.name}" (ID: ${match.id}) to "${rSpec.name}"...`);
                await match.setName(rSpec.name, `Role rename: ${match.name} -> ${rSpec.name}`);
                report.successfulOverwrites.push(`Renamed role "${match.name}" (ID: ${match.id}) to "${rSpec.name}"`);
                roleMap.set(rSpec.name.toLowerCase(), match);
              } catch (err: any) {
                report.failedOperations.push({
                  action: "rename_role",
                  target: match.name,
                  success: false,
                  error: {
                    code: err.code || "UNKNOWN",
                    message: err.message,
                    route: err.url
                  }
                });
              }
            } else {
              report.createdResources.roles.push(`[PREVIEW] Would rename existing role "${match.name}" (ID: ${match.id}) to "${rSpec.name}"`);
              roleMap.set(rSpec.name.toLowerCase(), match);
            }
            break;
          }
        }
      }

      if (!existing) {
        if (!previewOnly) {
          try {
            // Resolve permissions as bitfield
            const resolvedPerms = rSpec.permissions.reduce((acc, p) => {
              const flag = (PermissionFlagsBits as any)[p];
              return flag ? acc | flag : acc;
            }, 0n);

            const created = await guild.roles.create({
              name: rSpec.name,
              color: rSpec.colors?.primaryColor,
              colors: rSpec.colors,
              hoist: rSpec.hoist,
              permissions: resolvedPerms
            });

            report.createdResources.roles.push(rSpec.name);
            roleMap.set(rSpec.name.toLowerCase(), created);
          } catch (err: any) {
            report.failedOperations.push({
              action: "create_role",
              target: rSpec.name,
              success: false,
              error: {
                code: err.code || "UNKNOWN",
                message: err.message,
                route: err.url
              }
            });
          }
        } else {
          report.createdResources.roles.push(`[PREVIEW] ${rSpec.name}`);
        }
      }
    }

    // Refresh roles
    await guild.roles.fetch();
    guild.roles.cache.forEach((r) => roleMap.set(r.name.toLowerCase(), r));

    const modRoleId = process.env.MOD_ROLE_ID;
    const everyoneRole = guild.roles.everyone;
    const verifiedRole = roleMap.get("verified member") || roleMap.get("verified");
    const minorRole = roleMap.get("teen member") || roleMap.get("minor 13-17") || roleMap.get("minor 13–17");
    const adultRole = roleMap.get("18+ member") || roleMap.get("adult 18+");
    const staffRole = (modRoleId ? guild.roles.cache.get(modRoleId) : undefined) ?? roleMap.get("staff");

    // Fail-closed validation: ensure all required roles are resolved
    const missingRoles: string[] = [];
    if (!verifiedRole) missingRoles.push("Verified Member (or Verified)");
    if (!minorRole) missingRoles.push("Teen Member (or Minor 13-17)");
    if (!adultRole) missingRoles.push("18+ Member (or Adult 18+)");
    if (!staffRole) missingRoles.push("Staff (or MOD_ROLE_ID)");

    if (missingRoles.length > 0) {
      report.failedOperations.push({
        action: "create_role",
        target: missingRoles.join(", "),
        success: false,
        error: {
          code: "MISSING_REQUIRED_ROLE",
          message: `Required role(s) could not be resolved: ${missingRoles.join(", ")}`
        }
      });
      report.requiredManualActions.push(
        `Ensure roles [${missingRoles.join(", ")}] exist on the server and MOD_ROLE_ID is configured in .env.`
      );
    }

    // 2. Define Category & Channel Specifications with explicit bot allow
    const botOverwrite = { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] };

    const structureSpec = [
      {
        categoryName: "START HERE",
        categoryOverwrites: [
          botOverwrite,
          // Public: @everyone can view
          { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }
        ],
        channels: [
          {
            name: "verify",
            type: ChannelType.GuildText,
            topic: "Member onboarding & verification. Read rules and reply here.",
            overwrites: [
              botOverwrite,
              { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]
          },
          {
            name: "rules",
            type: ChannelType.GuildText,
            topic: "Community rules and guidelines.",
            overwrites: [
              botOverwrite,
              { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] }
            ]
          }
        ]
      },
      {
        categoryName: "COMMUNITY",
        categoryOverwrites: [
          botOverwrite,
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(verifiedRole ? [{ id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
          ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
        ],
        channels: [
          {
            name: "introductions",
            type: ChannelType.GuildText,
            topic: "Automated community introductions upon verification.",
            overwrites: []
          },
          {
            name: "ask-mods",
            type: ChannelType.GuildText,
            topic: "Questions for moderators and staff assistance.",
            overwrites: []
          }
        ]
      },
      {
        categoryName: "MINOR COMMUNITY",
        categoryOverwrites: [
          botOverwrite,
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(adultRole ? [{ id: adultRole.id, deny: [PermissionFlagsBits.ViewChannel] }] : []),
          ...(minorRole ? [{ id: minorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : []),
          ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : [])
        ],
        channels: [
          { name: "minor-community", type: ChannelType.GuildText, topic: "Minor-only general discussions (Ages 13-17).", overwrites: [] },
          { name: "minor-lfg", type: ChannelType.GuildText, topic: "Minor-only Looking For Group (LFG).", overwrites: [] },
          { name: "minor-voice", type: ChannelType.GuildVoice, topic: undefined, overwrites: [] }
        ]
      },
      {
        categoryName: "ADULT COMMUNITY",
        categoryOverwrites: [
          botOverwrite,
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(minorRole ? [{ id: minorRole.id, deny: [PermissionFlagsBits.ViewChannel] }] : []),
          ...(adultRole ? [{ id: adultRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : []),
          ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : [])
        ],
        channels: [
          { name: "adult-community", type: ChannelType.GuildText, topic: "Adult general discussions (Ages 18+).", overwrites: [] },
          { name: "adult-lfg", type: ChannelType.GuildText, topic: "Adult Looking For Group (LFG).", overwrites: [] },
          { name: "adult-voice", type: ChannelType.GuildVoice, topic: undefined, overwrites: [] }
        ]
      },
      {
        categoryName: "STAFF",
        categoryOverwrites: [
          botOverwrite,
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(minorRole ? [{ id: minorRole.id, deny: [PermissionFlagsBits.ViewChannel] }] : []),
          ...(adultRole ? [{ id: adultRole.id, deny: [PermissionFlagsBits.ViewChannel] }] : []),
          ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : []),
          { id: guild.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ],
        channels: [
          { name: "mod-alerts", type: ChannelType.GuildText, topic: "Automated moderator alerts and onboarding escalation logs.", overwrites: [] }
        ]
      }
    ];

    // 3. Provision Categories & Channels
    for (const catSpec of structureSpec) {
      let category = Array.from(guild.channels.cache.values()).find(
        (c: any) => c?.type === ChannelType.GuildCategory && c.name.toLowerCase() === catSpec.categoryName.toLowerCase()
      ) as CategoryChannel | undefined;

      // Create Category if missing
      if (!category) {
        if (!previewOnly) {
          try {
            category = await guild.channels.create({
              name: catSpec.categoryName,
              type: ChannelType.GuildCategory,
              permissionOverwrites: catSpec.categoryOverwrites as any
            });
            report.createdResources.categories.push(catSpec.categoryName);
            report.successfulOverwrites.push(`Initialized category permissions on [${catSpec.categoryName}]`);
          } catch (err: any) {
            report.failedOperations.push({
              action: "create_category",
              target: catSpec.categoryName,
              success: false,
              error: {
                code: err.code || "UNKNOWN",
                message: err.message,
                route: err.url
              }
            });
          }
        } else {
          report.createdResources.categories.push(`[PREVIEW] ${catSpec.categoryName}`);
          report.successfulOverwrites.push(`[PREVIEW] Would create category [${catSpec.categoryName}] with protected overwrites`);
        }
      } else {
        // Category exists: Check if bot has access before modifying overwrites
        const botPermsInCat = category.permissionsFor(me);
        if (!botPermsInCat || !botPermsInCat.has(PermissionFlagsBits.ViewChannel)) {
          // Bot was previously locked out of this category by @everyone deny without explicit bot allow
          report.failedOperations.push({
            action: "set_permission",
            target: `Category [${catSpec.categoryName}]`,
            targetId: category.id,
            success: false,
            error: {
              code: 50001,
              message: `Bot lacks ViewChannel access on category '${catSpec.categoryName}'. A server administrator must grant the bot role View Channel on this category in Discord settings.`,
              route: `/channels/${category.id}/permissions`
            }
          });
          report.requiredManualActions.push(
            `Open Discord Server Settings -> Channels -> Category '${catSpec.categoryName}' -> Permissions, and allow 'View Channel' for the bot's role (${me.roles.highest.name}).`
          );
        } else {
          // Bot has permissions: synchronize category permission overwrites
          if (catSpec.categoryOverwrites && catSpec.categoryOverwrites.length > 0) {
            if (!previewOnly) {
              try {
                await category.permissionOverwrites.set(catSpec.categoryOverwrites as any);
                report.successfulOverwrites.push(`Synchronized category permissions on [${catSpec.categoryName}]`);
              } catch (err: any) {
                report.failedOperations.push({
                  action: "set_permission",
                  target: `Category [${catSpec.categoryName}]`,
                  targetId: category.id,
                  success: false,
                  error: {
                    code: err.code || "UNKNOWN",
                    message: `Failed to set category overwrites on ${catSpec.categoryName}: ${err.message}`,
                    route: err.url
                  }
                });
              }
            } else {
              report.successfulOverwrites.push(`[PREVIEW] Would sync category permissions on [${catSpec.categoryName}]`);
            }
          }
        }
      }

      // Create or move Channels inside category
      for (const chSpec of catSpec.channels) {
        // Locate channel anywhere in the guild by name (to detect misparented channels)
        const existingChannel = Array.from(guild.channels.cache.values()).find(
          (c: any) =>
            c.name.toLowerCase() === chSpec.name.toLowerCase() &&
            c.type !== ChannelType.GuildCategory
        ) as GuildChannel | undefined;

        if (!existingChannel) {
          if (!previewOnly) {
            try {
              const targetChannel = await guild.channels.create({
                name: chSpec.name,
                type: chSpec.type as any,
                parent: category ? category.id : undefined,
                topic: chSpec.topic,
                permissionOverwrites: chSpec.overwrites.length > 0 ? (chSpec.overwrites as any) : undefined
              });

              report.createdResources.channels.push(`${chSpec.name} (${ChannelType[chSpec.type]})`);
              if (chSpec.overwrites.length > 0) {
                report.successfulOverwrites.push(`Initialized channel overwrites on #${chSpec.name}`);
              }
            } catch (err: any) {
              report.failedOperations.push({
                action: "create_channel",
                target: `#${chSpec.name}`,
                success: false,
                error: {
                  code: err.code || "UNKNOWN",
                  message: err.message,
                  route: err.url
                }
              });
            }
          } else {
            report.createdResources.channels.push(`[PREVIEW] #${chSpec.name}`);
            report.successfulOverwrites.push(`[PREVIEW] Would create channel #${chSpec.name} in category [${catSpec.categoryName}]`);
          }
        } else if (category && existingChannel.parentId !== category.id) {
          // Channel exists in the wrong parent category (e.g. ROOT instead of MINOR COMMUNITY)
          const currentParentName = existingChannel.parent?.name ?? "ROOT";
          if (!previewOnly) {
            try {
              await existingChannel.setParent(category.id, { lockPermissions: false });
              // If channel has no custom overwrites, lock/sync permissions to parent category
              if (chSpec.overwrites.length === 0) {
                try {
                  await existingChannel.lockPermissions();
                } catch {
                  // Fallback: manually copy category overwrites if lockPermissions is restricted
                  if (catSpec.categoryOverwrites && catSpec.categoryOverwrites.length > 0) {
                    await (existingChannel as any).permissionOverwrites.set(catSpec.categoryOverwrites);
                  }
                }
              } else {
                await (existingChannel as any).permissionOverwrites.set(chSpec.overwrites);
              }
              report.successfulOverwrites.push(`Re-parented #${chSpec.name} from [${currentParentName}] to category [${catSpec.categoryName}]`);
            } catch (err: any) {
              report.failedOperations.push({
                action: "set_permission",
                target: `#${chSpec.name}`,
                success: false,
                error: {
                  code: err.code || "UNKNOWN",
                  message: `Failed to move #${chSpec.name} from [${currentParentName}] to [${catSpec.categoryName}]: ${err.message}`
                }
              });
            }
          } else {
            report.successfulOverwrites.push(`[PREVIEW] Would re-parent #${chSpec.name} from [${currentParentName}] to category [${catSpec.categoryName}] and lock permissions`);
          }
        } else if (category && existingChannel.parentId === category.id) {
          // Channel is in the correct category - ensure category permissions are synchronized if channel has no custom overwrites
          if (chSpec.overwrites.length === 0 && catSpec.categoryOverwrites && catSpec.categoryOverwrites.length > 0) {
            if (!previewOnly) {
              try {
                // Ensure permission sync with category
                await existingChannel.lockPermissions().catch(async () => {
                  await (existingChannel as any).permissionOverwrites.set(catSpec.categoryOverwrites);
                });
                report.successfulOverwrites.push(`Synchronized channel permissions on #${chSpec.name} with category [${catSpec.categoryName}]`);
              } catch (err: any) {
                report.failedOperations.push({
                  action: "set_permission",
                  target: `#${chSpec.name}`,
                  success: false,
                  error: {
                    code: err.code || "UNKNOWN",
                    message: `Failed to sync permissions on #${chSpec.name}: ${err.message}`
                  }
                });
              }
            } else {
              report.successfulOverwrites.push(`[PREVIEW] Would lock/sync permissions on #${chSpec.name} with category [${catSpec.categoryName}]`);
            }
          } else if (chSpec.overwrites.length > 0) {
            if (!previewOnly) {
              try {
                await (existingChannel as any).permissionOverwrites.set(chSpec.overwrites);
                report.successfulOverwrites.push(`Synchronized custom channel permissions on #${chSpec.name}`);
              } catch (err: any) {
                report.failedOperations.push({
                  action: "set_permission",
                  target: `#${chSpec.name}`,
                  success: false,
                  error: {
                    code: err.code || "UNKNOWN",
                    message: `Failed to sync custom permissions on #${chSpec.name}: ${err.message}`
                  }
                });
              }
            } else {
              report.successfulOverwrites.push(`[PREVIEW] Would sync custom permissions on #${chSpec.name}`);
            }
          }
        }
      }
    }

    // 4. Perform Detailed Access & Minor/Adult Positive + Negative Isolation Audit
    await guild.channels.fetch();
    const auditChannels = [
      "verify",
      "rules",
      "introductions",
      "ask-mods",
      "minor-community",
      "minor-lfg",
      "minor-voice",
      "adult-community",
      "adult-lfg",
      "adult-voice",
      "mod-alerts"
    ];

    const allChannelsList = Array.from(guild.channels.cache.values()) as GuildChannel[];

    for (const name of auditChannels) {
      const ch = allChannelsList.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!ch) {
        if (allChannelsList.length > 5) {
          report.accessAudit.push({
            channelName: name,
            channelId: "MISSING",
            category: "MISSING",
            access: { everyone: false, minor: false, adult: false, verified: false, staff: false },
            positiveChecksPassed: false,
            negativeChecksPassed: false,
            isolationCompliant: false,
            isolationNotes: `FAIL: Protected channel #${name} does not exist on the server`
          });
        }
        continue;
      }

      const evalAccess = (role: Role | undefined | null): boolean => {
        if (!role) return false;
        const p = ch.permissionsFor(role);
        return p ? p.has(PermissionFlagsBits.ViewChannel) : false;
      };

      const access = {
        everyone: evalAccess(everyoneRole),
        minor: evalAccess(minorRole),
        adult: evalAccess(adultRole),
        verified: evalAccess(verifiedRole),
        staff: evalAccess(staffRole)
      };

      let positiveChecksPassed = true;
      let negativeChecksPassed = true;
      const issues: string[] = [];

      if (name.startsWith("minor-")) {
        // POSITIVE: Teen and Staff MUST be able to view minor channel
        if (!minorRole) {
          positiveChecksPassed = false;
          issues.push("FAIL CLOSED: Teen Member role missing or unresolvable");
        } else if (!access.minor) {
          positiveChecksPassed = false;
          issues.push("FAIL POSITIVE: Teen Member role cannot access minor channel");
        }

        if (!staffRole) {
          positiveChecksPassed = false;
          issues.push("FAIL CLOSED: Staff role missing or unresolvable");
        } else if (!access.staff) {
          positiveChecksPassed = false;
          issues.push("FAIL POSITIVE: Staff role cannot access minor channel");
        }

        // NEGATIVE: 18+, Verified-only, and @everyone MUST NOT view minor channel
        if (access.adult) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: 18+ Members have access to minor space");
        }
        if (access.everyone) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: @everyone has access to minor space");
        }
        if (access.verified) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: Verified-only role has access to minor space without Teen role");
        }
      } else if (name.startsWith("adult-")) {
        // POSITIVE: 18+ and Staff MUST be able to view adult channel
        if (!adultRole) {
          positiveChecksPassed = false;
          issues.push("FAIL CLOSED: 18+ Member role missing or unresolvable");
        } else if (!access.adult) {
          positiveChecksPassed = false;
          issues.push("FAIL POSITIVE: 18+ Member role cannot access adult channel");
        }

        if (!staffRole) {
          positiveChecksPassed = false;
          issues.push("FAIL CLOSED: Staff role missing or unresolvable");
        } else if (!access.staff) {
          positiveChecksPassed = false;
          issues.push("FAIL POSITIVE: Staff role cannot access adult channel");
        }

        // NEGATIVE: Teen, Verified-only, and @everyone MUST NOT view adult channel
        if (access.minor) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: Teen Members have access to adult space");
        }
        if (access.everyone) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: @everyone has access to adult space");
        }
        if (access.verified) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: Verified-only role has access to adult space without 18+ role");
        }
      } else if (name === "verify" || name === "rules") {
        // POSITIVE: @everyone (and all members) MUST view onboarding channels
        if (!access.everyone) {
          positiveChecksPassed = false;
          issues.push("FAIL POSITIVE: @everyone cannot see onboarding channel");
        }
      } else if (name === "introductions" || name === "ask-mods") {
        // POSITIVE: Verified members and Staff MUST view community channels
        if (!verifiedRole) {
          positiveChecksPassed = false;
          issues.push("FAIL CLOSED: Verified Member role missing or unresolvable");
        } else if (!access.verified) {
          positiveChecksPassed = false;
          issues.push("FAIL POSITIVE: Verified members cannot see community channel");
        }
        // NEGATIVE: Unverified (@everyone) MUST NOT view community channels
        if (access.everyone) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: Unverified (@everyone) can see community channel");
        }
      } else if (name === "mod-alerts") {
        // POSITIVE: Staff MUST view mod-alerts
        if (!staffRole) {
          positiveChecksPassed = false;
          issues.push("FAIL CLOSED: Staff role missing or unresolvable");
        } else if (!access.staff) {
          positiveChecksPassed = false;
          issues.push("FAIL POSITIVE: Staff cannot access mod-alerts");
        }
        // NEGATIVE: @everyone, minors, adults, and verified members without staff MUST NOT view mod-alerts
        if (access.everyone) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: @everyone can access mod-alerts");
        }
        if (access.minor) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: Minor can access mod-alerts");
        }
        if (access.adult) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: Adult can access mod-alerts");
        }
        if (access.verified) {
          negativeChecksPassed = false;
          issues.push("CRITICAL LEAK: Verified member without Staff can access mod-alerts");
        }
      }

      const isolationCompliant = positiveChecksPassed && negativeChecksPassed;
      const isolationNotes = issues.length > 0 ? issues.join(" | ") : undefined;

      report.accessAudit.push({
        channelName: ch.name,
        channelId: ch.id,
        category: ch.parent ? ch.parent.name : "ROOT",
        access,
        positiveChecksPassed,
        negativeChecksPassed,
        isolationCompliant,
        isolationNotes
      });
    }

    // 5. Compute Final Status & Summary
    const hasAuditFailures = report.accessAudit.some((a) => !a.isolationCompliant);
    const hasOperationFailures = report.failedOperations.length > 0;
    const hasFailures = hasOperationFailures || hasAuditFailures;
    const hasAnySuccess =
      report.createdResources.roles.length > 0 ||
      report.createdResources.categories.length > 0 ||
      report.createdResources.channels.length > 0 ||
      report.successfulOverwrites.length > 0;

    if (!hasFailures) {
      report.status = "FULL SUCCESS";
      report.summary = `Full success: Server structure and permissions are completely verified and provisioned.`;
    } else if (!hasAuditFailures && hasAnySuccess) {
      report.status = "PARTIAL SUCCESS";
      report.summary = `Partial success: Structure configured, but ${report.failedOperations.length} operation(s) require manual or configuration adjustments.`;
    } else {
      report.status = "FAILED";
      const failureReasons: string[] = [];
      if (hasAuditFailures) {
        const failedCount = report.accessAudit.filter(a => !a.isolationCompliant).length;
        failureReasons.push(`Permission/isolation check(s) failed on ${failedCount} protected channel(s)`);
      }
      if (hasOperationFailures) {
        failureReasons.push(`${report.failedOperations.length} operation(s) failed`);
      }
      report.summary = `Failed: ${failureReasons.join(" | ")}. Review required manual actions.`;
    }

    return report;
  }
}
