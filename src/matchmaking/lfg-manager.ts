import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  User,
  Guild
} from "discord.js";
import { LfgParty } from "../game-db.js";

const STATUS_COLORS = {
  open: "#10B981",    // Emerald
  full: "#FFB703",    // Amber
  closed: "#64748B",  // Slate
  cancelled: "#FF3366" // Crimson
};

/**
 * Builds the interactive LFG Party Card Embed with real-time roster and action buttons.
 */
export function buildLfgPartyEmbed(party: LfgParty, hostUser?: User | { id: string; username: string }) {
  const members = party.members || [party.host_user_id];
  const currentSlots = members.length;
  const isFull = currentSlots >= party.max_slots;
  const isOpen = party.status === "open" && !isFull && party.expires_at > Date.now();

  const statusColor = party.status === "cancelled"
    ? STATUS_COLORS.cancelled
    : party.status === "closed"
    ? STATUS_COLORS.closed
    : isFull
    ? STATUS_COLORS.full
    : STATUS_COLORS.open;

  const statusBadge = party.status === "cancelled"
    ? "🔴 SQUAD CANCELLED"
    : party.status === "closed"
    ? "🔒 SQUAD CLOSED"
    : isFull
    ? `🟡 SQUAD FULL [${currentSlots}/${party.max_slots}]`
    : `🟢 SQUAD RECRUITING [${currentSlots}/${party.max_slots}]`;

  // Build member roster lines
  const rosterLines = [];
  for (let i = 0; i < party.max_slots; i++) {
    const slotNum = i + 1;
    if (i < members.length) {
      const uId = members[i];
      const isLeader = uId === party.host_user_id;
      rosterLines.push(`${slotNum}. <@${uId}> ${isLeader ? "👑 *(Squad Leader)*" : "⚔️ *(Operative)*"}`);
    } else {
      rosterLines.push(`${slotNum}. *[ Open Slot — Click Join Below ]*`);
    }
  }

  const expiresMinutes = Math.max(0, Math.round((party.expires_at - Date.now()) / 60000));

  const embed = new EmbedBuilder()
    .setColor(statusColor as any)
    .setAuthor({
      name: `GAMER GEAR // SQUAD MATCHMAKER #PARTY-${party.id}`
    })
    .setTitle(`🎮 ${party.game_name.toUpperCase()} // ${party.activity.toUpperCase()}`)
    .setDescription(
      `**Status:** \`${statusBadge}\`\n` +
      `**Host:** <@${party.host_user_id}> | **Expires In:** \`${expiresMinutes} minutes\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• **Platform:** \`${party.platform}\`  |  **Playstyle:** \`${party.playstyle}\`\n` +
      (party.voice_channel_id ? `• **Voice Lounge:** <#${party.voice_channel_id}>\n` : `• **Voice Lounge:** Check 🔊 **VOICE** category\n`) +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields({
      name: `👥 Squad Roster (${currentSlots}/${party.max_slots})`,
      value: rosterLines.join("\n"),
      inline: false
    })
    .setFooter({
      text: "GAMING SHAMING • Instant LFG Squad Matchmaking • /lfg"
    })
    .setTimestamp(party.created_at);

  // Action Buttons
  const joinBtn = new ButtonBuilder()
    .setCustomId(`lfg_join_${party.id}`)
    .setLabel("🟢 Join Squad")
    .setStyle(ButtonStyle.Success)
    .setDisabled(!isOpen);

  const leaveBtn = new ButtonBuilder()
    .setCustomId(`lfg_leave_${party.id}`)
    .setLabel("🚪 Leave Squad")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(party.status === "closed" || party.status === "cancelled");

  const closeBtn = new ButtonBuilder()
    .setCustomId(`lfg_close_${party.id}`)
    .setLabel("🔒 Close Party")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(party.status === "closed" || party.status === "cancelled");

  const voiceBtn = new ButtonBuilder()
    .setLabel("🔊 Join Voice")
    .setStyle(ButtonStyle.Link)
    .setURL("https://discord.com/channels/924325170972340264/1566922349981466765");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinBtn, leaveBtn, closeBtn, voiceBtn);

  return { embed, components: [row] };
}

/**
 * Builds the interactive Modal for creating a new LFG party.
 */
export function buildCreatePartyModal(defaultGame: string = "Apex Legends"): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("lfg_create_modal_submit")
    .setTitle("Create LFG Squad Request");

  const gameInput = new TextInputBuilder()
    .setCustomId("lfg_modal_game")
    .setLabel("Game Name")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. Apex Legends, Lethal Company, Valorant...")
    .setValue(defaultGame)
    .setMaxLength(40)
    .setRequired(true);

  const activityInput = new TextInputBuilder()
    .setCustomId("lfg_modal_activity")
    .setLabel("Activity / Goal")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. Ranked Grind, Quota Runs, Casual Chill...")
    .setValue("Ranked Grind")
    .setMaxLength(50)
    .setRequired(true);

  const platformInput = new TextInputBuilder()
    .setCustomId("lfg_modal_platform")
    .setLabel("Platform (PC, PlayStation, Xbox, Crossplay)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Crossplay")
    .setValue("Crossplay")
    .setMaxLength(20)
    .setRequired(true);

  const slotsInput = new TextInputBuilder()
    .setCustomId("lfg_modal_slots")
    .setLabel("Max Squad Size (2 to 10)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("4")
    .setValue("4")
    .setMaxLength(2)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(gameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(activityInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(platformInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(slotsInput)
  );

  return modal;
}

/**
 * Builds an embed listing all active LFG parties.
 */
export function buildActivePartiesListEmbed(parties: LfgParty[]) {
  const lines = parties.length > 0
    ? parties.map(p => {
        const memCount = p.members?.length || 1;
        const status = p.status === "full" ? "🟡 FULL" : "🟢 OPEN";
        return `• [Party #${p.id}] **${p.game_name}** (${p.activity}) — ${status} \`[${memCount}/${p.max_slots}]\` Hosted by <@${p.host_user_id}>`;
      }).join("\n\n")
    : "*No active squad parties currently open. Use `/lfg create` to start one!*";

  const embed = new EmbedBuilder()
    .setColor("#00F0FF")
    .setTitle("🎮 Active Community LFG Squads")
    .setDescription(
      `Looking for a team? Jump into open squads in <#1566922336404246568> or create your own party.\n\n` +
      lines
    )
    .setFooter({ text: "GAMING SHAMING • Real-Time Matchmaking • /lfg" })
    .setTimestamp();

  return { embed };
}

