import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User
} from "discord.js";
import { MemberProfile } from "../game-db.js";

/**
 * Builds the /rank progression card using Discord native embeds.
 */
export function buildRankEmbed(
  targetUser: User | { id: string; username: string; displayAvatarURL?: () => string },
  profile: MemberProfile,
  rankIndex: number = 1,
  totalMembers: number = 31
) {
  const avatarUrl = typeof targetUser.displayAvatarURL === "function"
    ? targetUser.displayAvatarURL()
    : undefined;

  const xpNext = Math.pow(profile.level, 2) * 100;
  const xpCurrent = profile.xp;
  const progressRatio = Math.min(1, Math.max(0, xpCurrent / xpNext));
  const percent = Math.round(progressRatio * 100);
  const barBlocks = Math.round(progressRatio * 12);
  const progressBar = "█".repeat(barBlocks) + "░".repeat(12 - barBlocks);

  const embed = new EmbedBuilder()
    .setColor("#FFB703")
    .setAuthor({
      name: `GAMER GEAR // STANDING & REPUTATION`,
      iconURL: avatarUrl
    })
    .setTitle(`📈 ${targetUser.username}'s Community Standing`)
    .setDescription(
      `**Level ${profile.level} Operative**\n` +
      `\`[${progressBar}] ${percent}%\`\n` +
      `**XP:** \`${xpCurrent.toLocaleString()}\` / \`${xpNext.toLocaleString()}\` XP`
    )
    .addFields(
      {
        name: "🏆 Server Leaderboard",
        value: `Position: **#${rankIndex}** of ${totalMembers} members`,
        inline: true
      },
      {
        name: "🌟 Reputation",
        value: `**+${profile.reputation} REP** points`,
        inline: true
      },
      {
        name: "💡 Earning XP & Leveling Up",
        value: [
          "• Chat actively in <#924325170972340266> *(general-chat)*",
          "• Squad up in <#1566922336404246568> *(looking-for-group)*",
          "• Join voice channels in **VOICE** category",
          "• Check rank announcements in <#924522879859716097> *(level-ups)*"
        ].join("\n"),
        inline: false
      }
    )
    .setFooter({
      text: "GAMING SHAMING • Power by Gamer Gear & Arcane • /rank",
      iconURL: avatarUrl
    })
    .setTimestamp();

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const profileBtn = new ButtonBuilder()
    .setCustomId(`profile_view_${targetUser.id}`)
    .setLabel("🎮 Full Profile")
    .setStyle(ButtonStyle.Primary);

  const badgesBtn = new ButtonBuilder()
    .setCustomId(`profile_badges_${targetUser.id}`)
    .setLabel("🏆 View Badges")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(profileBtn, badgesBtn);

  return { embed, components: [row] };
}

/**
 * Builds the server-wide top 10 leaderboard embed.
 */
export function buildLeaderboardEmbed(
  entries: Array<MemberProfile & { rank: number }>,
  requesterId?: string
) {
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

  const lines = entries.slice(0, 10).map((entry, idx) => {
    const medal = medals[idx] || `#${entry.rank}`;
    const isMe = entry.user_id === requesterId ? " 👈 *(You)*" : "";
    return `${medal} <@${entry.user_id}> — **Lvl ${entry.level}** (${entry.xp.toLocaleString()} XP) | 🌟 +${entry.reputation} REP${isMe}`;
  }).join("\n");

  const embed = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setTitle("⚡ GAMING SHAMING Community Leaderboard")
    .setDescription(
      "Top ranked operatives across gaming activity, reputation, and participation.\n\n" +
      (lines || "*No leaderboard data recorded yet.*")
    )
    .setFooter({ text: "GAMING SHAMING • Updated in Real-Time" })
    .setTimestamp();

  return { embed };
}

