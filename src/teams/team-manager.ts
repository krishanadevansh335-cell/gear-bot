import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { Team } from "../game-db.js";

/**
 * Builds the official GAMING SHAMING Team / Clan Dossier Embed.
 */
export function buildTeamEmbed(team: Team) {
  const members = team.members || [];
  const captain = members.find(m => m.role === "captain")?.user_id || team.captain_user_id;

  const rosterLines = members.length > 0
    ? members.map((m, idx) => {
        const isCap = m.role === "captain";
        return `${idx + 1}. <@${m.user_id}> ${isCap ? "👑 *(Captain)*" : "⚔️ *(Member)*"}`;
      }).join("\n")
    : `1. <@${captain}> 👑 *(Captain)*`;

  const embed = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setAuthor({ name: "GAMER GEAR // SQUAD ROSTER REGISTRY" })
    .setTitle(`🛡️ [${team.tag}] ${team.name.toUpperCase()}`)
    .setDescription(
      `**Official Clan / Scrim Team** registered in GAMING SHAMING.\n` +
      `**Primary Game:** \`${team.game_slug.toUpperCase()}\`\n` +
      `**Team Captain:** <@${captain}>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**Active Roster (${members.length || 1} Operatives):**\n` +
      rosterLines + `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setFooter({ text: "GAMING SHAMING • Competitive Clan Network • /team" })
    .setTimestamp(team.created_at);

  return { embed };
}

