import { DEFAULT_PROHIBITED_ROLES } from "./native-onboarding.js";

export interface ZiraItemSpec {
  name: string;
  targetRoleName: string;
  emoji?: string;
  description?: string;
}

export interface ZiraPanelSpec {
  id: string;
  title: string;
  channelName: string;
  type: "select_menu" | "buttons";
  multiSelect: boolean;
  items: ZiraItemSpec[];
}

export const ZIRA_PANELS: ZiraPanelSpec[] = [
  {
    id: "panel_games",
    title: "🎮 Choose Your Games",
    channelName: "choose-roles",
    type: "select_menu",
    multiSelect: true,
    items: [
      { name: "Apex Legends", targetRoleName: "Apex Squad", emoji: "🔴" },
      { name: "Palworld", targetRoleName: "Palworld Crew", emoji: "🐾" },
      { name: "Minecraft", targetRoleName: "Minecraft Crew", emoji: "⛏️" },
      { name: "Valorant", targetRoleName: "Valorant Squad", emoji: "🎯" },
      { name: "Fortnite", targetRoleName: "Fortnite Crew", emoji: "🪂" },
      { name: "PUBG", targetRoleName: "PUBG Squad", emoji: "🍳" },
      { name: "Warframe", targetRoleName: "Warframe Crew", emoji: "⚔️" },
      { name: "Destiny 2", targetRoleName: "Destiny 2 Crew", emoji: "🌌" },
      { name: "Helldivers 2", targetRoleName: "Helldivers Crew", emoji: "🛡️" },
      { name: "GTA Online", targetRoleName: "GTA Online Crew", emoji: "🚗" },
      { name: "Monster Hunter Wilds", targetRoleName: "Monster Hunter Crew", emoji: "🦖" },
      { name: "Other Games", targetRoleName: "Other Games", emoji: "🎲" }
    ]
  },
  {
    id: "panel_platform",
    title: "🖥️ Choose Your Platform",
    channelName: "choose-roles",
    type: "buttons",
    multiSelect: true,
    items: [
      { name: "PC", targetRoleName: "PC Gamer", emoji: "💻" },
      { name: "PlayStation", targetRoleName: "PlayStation Gamer", emoji: "🎮" },
      { name: "Xbox", targetRoleName: "Xbox Gamer", emoji: "🟩" },
      { name: "Mobile", targetRoleName: "Mobile Gamer", emoji: "📱" },
      { name: "Nintendo Switch", targetRoleName: "Nintendo Switch Gamer", emoji: "🕹️" }
    ]
  },
  {
    id: "panel_preferences",
    title: "⚡ Gaming Preferences",
    channelName: "choose-roles",
    type: "buttons",
    multiSelect: true,
    items: [
      { name: "Competitive", targetRoleName: "Competitive", emoji: "🏆" },
      { name: "Casual", targetRoleName: "Casual Gamer", emoji: "☕" },
      { name: "Co-op", targetRoleName: "Co-op Gamer", emoji: "🤝" },
      { name: "Survival", targetRoleName: "Survival Gamer", emoji: "🏕️" },
      { name: "RPG", targetRoleName: "RPG Gamer", emoji: "📜" },
      { name: "Horror", targetRoleName: "Horror Gamer", emoji: "👻" },
      { name: "Social Gaming", targetRoleName: "Social Gamer", emoji: "💬" }
    ]
  },
  {
    id: "panel_notifications",
    title: "🔔 Notifications",
    channelName: "choose-roles",
    type: "buttons",
    multiSelect: true,
    items: [
      { name: "Game Events", targetRoleName: "Game Events", emoji: "📅" },
      { name: "Tournaments", targetRoleName: "Tournaments", emoji: "🥇" },
      { name: "Announcements", targetRoleName: "Announcements", emoji: "📢" },
      { name: "Giveaways", targetRoleName: "Giveaways", emoji: "🎁" },
      { name: "Game Updates", targetRoleName: "Game Updates", emoji: "🔄" }
    ]
  }
];

export const ZIRA_RESTRICTED_ROLES = [
  ...DEFAULT_PROHIBITED_ROLES,
  "Verified Member",
  "Teen Member",
  "18+ Member"
];

export interface ResolvedZiraItem {
  panelId: string;
  panelTitle: string;
  optionName: string;
  targetRoleName: string;
  roleId?: string;
  position?: number;
  exists: boolean;
  status: "READY" | "MISSING" | "RESTRICTED";
  notes?: string;
}

export interface ZiraResolutionReport {
  ready: boolean;
  items: ResolvedZiraItem[];
  missingRoles: string[];
  restrictedViolations: string[];
  panels: ZiraPanelSpec[];
}

export function resolveZiraPanels(
  rolesList: Array<{ id: string; name: string; position: number }>
): ZiraResolutionReport {
  const roleMapByName = new Map<string, { id: string; name: string; position: number }>();
  for (const r of rolesList) {
    roleMapByName.set(r.name.toLowerCase().trim(), r);
  }

  const restrictedLower = ZIRA_RESTRICTED_ROLES.map((r) => r.toLowerCase().trim());
  const items: ResolvedZiraItem[] = [];
  const missingRoles: string[] = [];
  const restrictedViolations: string[] = [];

  for (const panel of ZIRA_PANELS) {
    for (const item of panel.items) {
      const isRestricted = restrictedLower.includes(item.targetRoleName.toLowerCase().trim());
      if (isRestricted) {
        restrictedViolations.push(item.targetRoleName);
        items.push({
          panelId: panel.id,
          panelTitle: panel.title,
          optionName: item.name,
          targetRoleName: item.targetRoleName,
          exists: false,
          status: "RESTRICTED",
          notes: "Security violation: Zira must never assign clearance or staff roles"
        });
        continue;
      }

      const match = roleMapByName.get(item.targetRoleName.toLowerCase().trim());
      if (match) {
        items.push({
          panelId: panel.id,
          panelTitle: panel.title,
          optionName: item.name,
          targetRoleName: item.targetRoleName,
          roleId: match.id,
          position: match.position,
          exists: true,
          status: "READY",
          notes: "Role verified on server"
        });
      } else {
        if (!missingRoles.includes(item.targetRoleName)) {
          missingRoles.push(item.targetRoleName);
        }
        items.push({
          panelId: panel.id,
          panelTitle: panel.title,
          optionName: item.name,
          targetRoleName: item.targetRoleName,
          exists: false,
          status: "MISSING",
          notes: "Role does not exist in Discord guild"
        });
      }
    }
  }

  return {
    ready: missingRoles.length === 0 && restrictedViolations.length === 0,
    items,
    missingRoles,
    restrictedViolations,
    panels: ZIRA_PANELS
  };
}

