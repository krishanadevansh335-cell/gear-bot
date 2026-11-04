import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  User,
  GuildMember
} from "discord.js";
import { MemberProfile, Badge } from "../game-db.js";

/**
 * Builds the official GAMING SHAMING Member Profile Embed.
 * Uses Discord native embeds, styled with Electric Purple (#8A2BE2) and Cyber Cyan (#00F0FF).
 * Guarantees ZERO disclosure of sensitive verification fields (age, gender).
 */
export function buildProfileEmbed(
  targetUser: User | { id: string; username: string; displayAvatarURL?: () => string },
  profile: MemberProfile,
  badges: Badge[] = [],
  rankIndex?: number
) {
  const avatarUrl = typeof targetUser.displayAvatarURL === "function"
    ? targetUser.displayAvatarURL()
    : undefined;

  const xpNext = Math.pow(profile.level, 2) * 100;
  const xpCurrent = profile.xp;
  const progressRatio = Math.min(1, Math.max(0, xpCurrent / xpNext));
  const barBlocks = Math.round(progressRatio * 10);
  const progressBar = "█".repeat(barBlocks) + "░".repeat(10 - barBlocks);

  const badgeString = badges.length > 0
    ? badges.map(b => `${b.emoji} \`${b.name}\``).join("  ")
    : "*No badges earned yet. Participate in community events and LFG to earn honors!*";

  const embed = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setAuthor({
      name: `GAMER GEAR // DOSSIER: ${targetUser.username.toUpperCase()}`,
      iconURL: avatarUrl
    })
    .setTitle(`🎮 ${targetUser.username}'s Player Profile`)
    .setDescription(
      profile.bio && profile.bio.trim().length > 0
        ? `> *"${profile.bio.trim()}"*`
        : `> *New operative in GAMING SHAMING. Ready to squad up.*`
    )
    .addFields(
      {
        name: "🎯 Combat Preferences",
        value: [
          `• **Primary Game:** \`${profile.primary_game}\``,
          `• **Platform:** \`${profile.platform}\``,
          `• **Playstyle:** \`${profile.playstyle}\``
        ].join("\n"),
        inline: true
      },
      {
        name: "⏰ Schedule & Region",
        value: [
          `• **Timing:** \`${profile.timing}\``,
          `• **Timezone:** \`${profile.timezone}\``,
          `• **Availability:** Active Squad Member`
        ].join("\n"),
        inline: true
      },
      {
        name: "📈 Progression & Standing",
        value: [
          `• **Level:** \`${profile.level}\`  |  **Rank:** \`#${rankIndex || 1}\``,
          `• **XP:** \`${xpCurrent.toLocaleString()} / ${xpNext.toLocaleString()}\` [${progressBar}]`,
          `• **Reputation:** 🌟 \`+${profile.reputation} REP\``
        ].join("\n"),
        inline: false
      },
      {
        name: `🏆 Honor Badges (${badges.length})`,
        value: badgeString,
        inline: false
      }
    )
    .setFooter({
      text: "GAMING SHAMING • Gamer Gear Identity Network • /profile",
      iconURL: avatarUrl
    })
    .setTimestamp();

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  // Interactive profile control buttons
  const editBtn = new ButtonBuilder()
    .setCustomId(`profile_edit_${targetUser.id}`)
    .setLabel("✏️ Edit Profile")
    .setStyle(ButtonStyle.Primary);

  const badgesBtn = new ButtonBuilder()
    .setCustomId(`profile_badges_${targetUser.id}`)
    .setLabel("🏆 Honor Badges")
    .setStyle(ButtonStyle.Secondary);

  const gamesBtn = new ButtonBuilder()
    .setCustomId(`profile_games_${targetUser.id}`)
    .setLabel("🎮 Squad Games")
    .setStyle(ButtonStyle.Secondary);

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(editBtn, badgesBtn, gamesBtn);

  return { embed, components: [actionRow] };
}

/**
 * Builds modal for updating bio, primary game, and timezone.
 */
export function buildProfileEditModal(currentProfile?: Partial<MemberProfile>): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("profile_edit_modal_submit")
    .setTitle("Configure Gamer Profile");

  const bioInput = new TextInputBuilder()
    .setCustomId("profile_modal_bio")
    .setLabel("Profile Bio / Play Motto")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Drop your gaming motto, main agents, or favorite game mode...")
    .setValue(currentProfile?.bio || "")
    .setMaxLength(200)
    .setRequired(false);

  const primaryGameInput = new TextInputBuilder()
    .setCustomId("profile_modal_game")
    .setLabel("Primary Favorite Game")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. Apex Legends, Valorant, Palworld...")
    .setValue(currentProfile?.primary_game || "Apex Legends")
    .setMaxLength(40)
    .setRequired(true);

  const timezoneInput = new TextInputBuilder()
    .setCustomId("profile_modal_tz")
    .setLabel("Timezone / Region")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. EST, PST, CET, UTC+5:30...")
    .setValue(currentProfile?.timezone || "UTC")
    .setMaxLength(20)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(bioInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(primaryGameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(timezoneInput)
  );

  return modal;
}

/**
 * Builds selection rows for platform, playstyle, and schedule preferences.
 */
export function buildProfilePreferencesRows(currentProfile?: Partial<MemberProfile>) {
  const platformMenu = new StringSelectMenuBuilder()
    .setCustomId("profile_platform_select")
    .setPlaceholder(`Current Platform: ${currentProfile?.platform || "PC"}`)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("PC").setValue("PC").setEmoji("🖥️"),
      new StringSelectMenuOptionBuilder().setLabel("PlayStation").setValue("PlayStation").setEmoji("🎮"),
      new StringSelectMenuOptionBuilder().setLabel("Xbox").setValue("Xbox").setEmoji("🟩"),
      new StringSelectMenuOptionBuilder().setLabel("Nintendo Switch").setValue("Nintendo Switch").setEmoji("🔴"),
      new StringSelectMenuOptionBuilder().setLabel("Mobile").setValue("Mobile").setEmoji("📱")
    );

  const playstyleMenu = new StringSelectMenuBuilder()
    .setCustomId("profile_playstyle_select")
    .setPlaceholder(`Current Playstyle: ${currentProfile?.playstyle || "Casual"}`)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Competitive / Ranked").setValue("Competitive").setEmoji("⚔️"),
      new StringSelectMenuOptionBuilder().setLabel("Casual & Relaxed").setValue("Casual").setEmoji("☕"),
      new StringSelectMenuOptionBuilder().setLabel("Co-op & PVE").setValue("Co-op").setEmoji("🤝"),
      new StringSelectMenuOptionBuilder().setLabel("Survival & Crafting").setValue("Survival").setEmoji("🏕️"),
      new StringSelectMenuOptionBuilder().setLabel("RPG & Adventure").setValue("RPG").setEmoji("🏹"),
      new StringSelectMenuOptionBuilder().setLabel("Horror & Investigation").setValue("Horror").setEmoji("👻")
    );

  const timingMenu = new StringSelectMenuBuilder()
    .setCustomId("profile_timing_select")
    .setPlaceholder(`Current Schedule: ${currentProfile?.timing || "Evenings"}`)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Evenings & Nights").setValue("Evenings").setEmoji("🌙"),
      new StringSelectMenuOptionBuilder().setLabel("Weekends Only").setValue("Weekends").setEmoji("🎉"),
      new StringSelectMenuOptionBuilder().setLabel("All Day / Anytime").setValue("All Day").setEmoji("☀️"),
      new StringSelectMenuOptionBuilder().setLabel("Late Night Scrims").setValue("Late Night").setEmoji("🦉"),
      new StringSelectMenuOptionBuilder().setLabel("Weekdays").setValue("Weekdays").setEmoji("📅")
    );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(platformMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(playstyleMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timingMenu)
  ];
}

