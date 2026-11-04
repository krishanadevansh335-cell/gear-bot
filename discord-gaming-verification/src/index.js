import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, ActivityType,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder
} from 'discord.js';
import { GameDatabase } from '../../dist/game-db.js';
import { DynamicGameManager } from '../../dist/game-manager.js';
import {
  buildGameCommands,
  handleGameCommands,
  handleMemberIdentityCommands,
  handleMemberIdentityComponents
} from '../../dist/game-commands.js';
import { buildLeaderboardEmbed } from '../../dist/profiles/rank-manager.js';
import { buildProfileEmbed } from '../../dist/profiles/profile-manager.js';
import {
  parseSchedule,
  parseLookingFor,
  parseGender,
  parseGamesNatural,
  buildConfirmationSummary,
  formatConfirmationCard,
  detectSensitiveLeak,
  validateAgeInput
} from '../../dist/verification-parser.js';
import {
  buildPublicVerifyWelcome,
  buildStepAgePayload,
  buildAgeInputModal,
  buildStepGenderPayload,
  buildStepGamesPayload,
  buildMissingPlatformSkillPayload,
  buildMissingSkillPayload,
  buildStepTimingPayload,
  buildStepLookingPayload,
  buildStepLanguagePayload,
  buildConfirmationPayload,
  buildOnboardingDetectedPayload,
  buildOnboardingPlatformPayload,
  buildOnboardingExperiencePayload
} from '../../dist/verification-ui.js';
import {
  IDS, BUILD_PRESETS, buildPresetEmbed, buildMarketModal, formatMarketEmbed
} from './gear-features.js';

const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.TOKEN;
const guildId = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || process.env.SERVER_ID || process.env.DISCORD_SERVER_ID || '924325170972340264';
const modRoleId = process.env.MOD_ROLE_ID || process.env.MODERATOR_ROLE_ID;

if (!token) {
  console.error('[STARTUP_ERROR] Missing Discord Bot Token!');
  console.error('[STARTUP_ERROR] In Bot-Hosting.net: either add DISCORD_BOT_TOKEN in the Startup/Variables tab, or go to Files -> New File -> create a .env file with DISCORD_BOT_TOKEN=your_token');
  throw new Error('Set DISCORD_BOT_TOKEN in .env or environment variables');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

// SQLite persistent database for games, requests, profiles, audit logs, and verification sessions
const db = new GameDatabase();
db.seedCategoriesAndGames();
let gameManager = null;
const timers = new Map();

const names = {
  verify: 'verify', rules: 'rules', mods: 'ask-mods', intros: 'introductions',
  minorText: 'teen-chat', minorLfg: 'teen-lfg', minorVoice: 'Teen Voice',
  adultText: 'adult-community', adultLfg: 'adult-lfg', adultVoice: 'adult-voice',
  modText: 'mod-alerts'
};

const safe = (s) => String(s).replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 90);
const norm = (s) => s.trim().toLowerCase();

// Build combined slash commands list
const baseCommands = [
  new SlashCommandBuilder().setName('setup-verification').setDescription('Post the public Start Verification message in #verify.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('verification-status').setDescription('Show your verification status.'),
  new SlashCommandBuilder().setName('review-pending').setDescription('List members awaiting moderator review.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('build')
    .setDescription('Get balanced Indian PC build recommendations for your budget (₹30K to ₹2L+).')
    .addStringOption(opt =>
      opt.setName('budget')
        .setDescription('Target build budget in INR')
        .setRequired(true)
        .addChoices(
          { name: '₹30,000 - Esports Starter (Ryzen 5600G APU)', value: '30k' },
          { name: '₹50,000 - 1080p Ultra High-FPS (RX 6600)', value: '50k' },
          { name: '₹80,000 - 1440p Sweet Spot (RTX 4060 / AM5)', value: '80k' },
          { name: '₹1,20,000 - 1440p Esports Monster (RTX 4070 Super)', value: '120k' },
          { name: '₹2,00,000+ - 4K God Tier Enthusiast (RTX 4080 Super / 7800X3D)', value: '200k' }
        )
    ),
  new SlashCommandBuilder()
    .setName('setup-leaderboard')
    .setDescription('View the Top 5 highest rated battlestations in Rate My Setup.'),
  new SlashCommandBuilder()
    .setName('crown-king')
    .setDescription('Award the official Battlestation King role to a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt => opt.setName('user').setDescription('The member to crown as Battlestation King').setRequired(true))
].map(x => x.toJSON());

const gameCommandsList = buildGameCommands().map(x => x.toJSON());
const allCommands = [...baseCommands, ...gameCommandsList];

async function role(guild, name, color = '#5865F2') {
  let r = guild.roles.cache.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!r) {
    const me = await guild.members.fetchMe();
    const canManageRoles = me.permissions.has(PermissionFlagsBits.ManageRoles);
    if (!canManageRoles) return null;
    r = await guild.roles.create({
      name,
      colors: { primaryColor: color },
      hoist: false,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ]
    });
  }
  return r;
}

async function alertMods(guild, message) {
  const c = guild.channels.cache.find(x => x.name === names.modText) || guild.channels.cache.find(x => x.name === names.mods);
  const mention = modRoleId ? `<@&${modRoleId}> ` : `<@${guild.ownerId}> `;
  if (c?.isTextBased()) await c.send({ content: `${mention}${message}`, allowedMentions: { parse: [], users: [guild.ownerId], roles: modRoleId ? [modRoleId] : [] } }).catch(() => {});
}

function cancelTimer(key) { const list = timers.get(key) || []; for (const t of list) clearTimeout(t); timers.delete(key); }

function scheduleTimers(guild, userId) {
  const key = `${guild.id}:${userId}`; cancelTimer(key);
  const s = db.getVerificationSession(guild.id, userId);
  if (!s || s.status === 'completed' || s.status === 'review') return;
  const created = s.created_at ?? Date.now();
  const age = Date.now() - created;
  const handles = [];
  if (age < 10 * 60_000 && !s.reminded) handles.push(setTimeout(async () => {
    const cur = db.getVerificationSession(guild.id, userId);
    if (!cur || cur.status === 'completed' || cur.status === 'review') return;
    db.updateVerificationSession(guild.id, userId, { reminded: true });
    const ch = guild.channels.cache.get('1566854065688813688') || guild.channels.cache.find(c => c.name.includes('erify'));
    await ch?.send({
      content: `👋 <@${userId}> Your verification is still waiting. Click the **Start Verification** button in <#${ch.id}> whenever you're ready!`,
      allowedMentions: { parse: [], users: [userId] }
    }).catch(() => {});
  }, 10 * 60_000 - age));
  if (age < 24 * 60 * 60_000) handles.push(setTimeout(() => {
    const cur = db.getVerificationSession(guild.id, userId);
    if (!cur || cur.status === 'completed' || cur.status === 'review') return;
    cancelTimer(key);
  }, 24 * 60 * 60_000 - age));
  timers.set(key, handles);
}

/**
 * Public onboarding greeting directing members from onboarding destination to #verify,
 * with personalized thank-you message, expressive emojis, and Start Verification button in #verify.
 */
async function begin(member) {
  const guild = member.guild;
  const { created, session } = db.getOrCreateVerificationSession(guild.id, member.id);
  if (!created && (session.status === 'completed' || session.status === 'review')) {
    return;
  }
  scheduleTimers(guild, member.id);

  const verifyCh = guild.channels.cache.get('1566854065688813688') || guild.channels.cache.find(c => c.name.includes('erify'));
  const rulesCh = guild.channels.cache.get('924522829490323516') || guild.channels.cache.find(c => c.name.includes('ules'));
  const welcomeCh = guild.channels.cache.get('924522763396468736') || guild.channels.cache.find(c => c.name.includes('elcome'));

  const avatarUrl = member.user?.displayAvatarURL ? member.user.displayAvatarURL({ size: 256 }) : undefined;
  const guildIcon = guild.iconURL ? guild.iconURL({ size: 128 }) : undefined;

  // 1. Direct member from the onboarding destination (#welcome) to #verify with personalized thank-you card
  if (welcomeCh && welcomeCh.isTextBased() && verifyCh) {
    const jumpRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('🛡️ Complete Verification in #verify')
        .setURL(`https://discord.com/channels/${guild.id}/${verifyCh.id}`)
    );

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`✨ 🎉 WELCOME TO GAMING SHAMING, ${member.displayName}! 🎉 ✨`)
      .setDescription([
        `Hey <@${member.id}>! **Thank you so much for joining our community!** 🙌💫 We are super hyped to have you here!`,
        '',
        `You have successfully finished Discord's initial onboarding questions. 🎮✨`,
        '',
        `👉 **Next Step:** Head over to <#${verifyCh.id}> to complete your **Gamer Gear Verification**.`,
        'It takes only ~30 seconds to pick your games and automatically unlocks all text lounges, voice rooms, and squad matchmaking! 🚀🔥',
        '',
        'Click the button below to jump straight to verification! ⬇️'
      ].join('\n'))
      .setFooter({ text: 'Gamer Gear • Automatic Onboarding Gateway', iconURL: guildIcon })
      .setTimestamp();

    if (avatarUrl) {
      welcomeEmbed.setThumbnail(avatarUrl);
    }

    await welcomeCh.send({
      content: `🎉✨ **WELCOME <@${member.id}>!** Thank you for joining **GAMING SHAMING**! 🎮🔥 Please head to <#${verifyCh.id}> to unlock all channels:`,
      embeds: [welcomeEmbed],
      components: [jumpRow],
      allowedMentions: { parse: [], users: [member.id] }
    }).catch(() => {});
  }

  // 2. Greeting in #verify with Start Verification button & personalized thank you card
  if (verifyCh && verifyCh.isTextBased()) {
    const welcome = buildPublicVerifyWelcome(rulesCh ? rulesCh.id : undefined);

    const verifyEmbed = new EmbedBuilder()
      .setColor(0x00E5FF)
      .setTitle(`🛡️ GAMER GEAR VERIFICATION CHECKPOINT ✨`)
      .setDescription([
        `Welcome <@${member.id}>! **Thank you for joining GAMING SHAMING!** 🎮🎉`,
        '',
        'Click **Start Verification** below to configure your gamer card:',
        '• 🔞 **Age Classification** (18+ / Teen)',
        '• 👤 **Gender** *(Optional & Private)*',
        '• 🎯 **Main Games** (Valorant, CS2, Minecraft, etc.)',
        '• ⏰ **Play Schedule & Timezone**',
        '• 🔍 **Looking For** (Competitive, Casual, Duo/Trio)',
        '• 🎙️ **Voice Language**',
        '',
        '⚡ *Takes ~30 seconds and awards your @Verified Member role instantly!* 💫'
      ].join('\n'))
      .setFooter({ text: 'Gamer Gear Verification Wall', iconURL: guildIcon })
      .setTimestamp();

    if (avatarUrl) {
      verifyEmbed.setThumbnail(avatarUrl);
    }

    await verifyCh.send({
      content: `✨ 🎮 **Welcome <@${member.id}>! Thank you for joining the server!** 🎮 ✨\nPlease click **Start Verification** below to unlock your channels:`,
      embeds: [verifyEmbed],
      components: welcome.components,
      allowedMentions: { parse: [], users: [member.id] }
    }).catch(() => {});
  }

  // 3. Optional friendly direct message (fails silently if member has DMs disabled)
  member.send?.({
    content: `🎉 **Thank you for joining GAMING SHAMING, ${member.displayName}!** ✨🎮\n\nTo unlock all channels, please complete your Gamer Gear verification here:\n👉 <https://discord.com/channels/${guild.id}/${verifyCh?.id || ''}>\n\nWe look forward to gaming with you! 🚀🔥`
  }).catch(() => {});
}

/**
 * Maps current session step to interactive ephemeral UI payload
 */
function getStepPayload(session, guild) {
  const step = session.step || 'games';
  const answers = session.answers || {};

  switch (step) {
    case 'detected':
      return buildOnboardingDetectedPayload({
        games: answers.games || [],
        platforms: answers.platforms || [],
        experiences: answers.experiences || []
      });
    case 'games': {
      const allGames = [
        ...db.getGamesByCategory('fps_competitive'),
        ...db.getGamesByCategory('survival_sandbox'),
        ...db.getGamesByCategory('coop_horror')
      ];
      return buildStepGamesPayload(answers.games || [], allGames);
    }
    case 'platform':
      return buildOnboardingPlatformPayload(answers.platforms || []);
    case 'experience':
      return buildOnboardingExperiencePayload(answers.experiences || []);
    case 'agree':
    case 'age':
      return buildStepAgePayload();
    case 'gender':
      return buildStepGenderPayload();
    case 'timing':
      return buildStepTimingPayload(answers.timing, answers.timezone);
    case 'looking':
      return buildStepLookingPayload(answers.looking_preferences || []);
    case 'language':
      return buildStepLanguagePayload(answers.language);
    case 'confirm':
      return buildConfirmationPayload(answers);
    default:
      return buildStepAgePayload();
  }
}

// Native Onboarding Role Sets & Name Mappings (Mapped to the 3 questions configured in Discord Native Onboarding)
const ONBOARDING_GAME_ROLE_IDS = new Set([
  '1566910787862134898', // Apex Squad
  '1566910790739558400', // Palworld Crew
  '1566910792744443924', // Minecraft Crew
  '1566910795252764692', // Valorant Squad
  '1566910798016806942', // Fortnite Crew
  '1566910802147942611', // PUBG Squad
  '1566910803909541968', // Warframe Crew
  '1566910805843255513', // Destiny 2 Crew
  '1566910809538428938', // Helldivers Crew
  '1566910811446841484', // GTA Online Crew
  '1566910813048930538', // Monster Hunter Crew
  '1566910820548476968'  // Other Games
]);

const ONBOARDING_PLATFORM_ROLE_IDS = new Set([
  '1566910823324975107', // PC Gamer
  '1566910825925447822', // PlayStation Gamer
  '1566910837384544277', // Xbox Gamer
  '1566910839964041308', // Mobile Gamer
  '1566910842803585054'  // Nintendo Switch Gamer
]);

const ONBOARDING_EXPERIENCE_ROLE_IDS = new Set([
  '1566910846532325517', // Competitive
  '1566910849422200942', // Casual Gamer
  '1566910852031062126', // Co-op Gamer
  '1566910854518280374', // Survival Gamer
  '1566910856900378815', // RPG Gamer
  '1566910859442127001', // Horror Gamer
  '1566910861337960458'  // Social Gamer
]);

const GAME_ROLE_ID_TO_NAME = {
  '1566910787862134898': 'Apex Legends',
  '1566910790739558400': 'Palworld',
  '1566910792744443924': 'Minecraft',
  '1566910795252764692': 'Valorant',
  '1566910798016806942': 'Fortnite',
  '1566910802147942611': 'PUBG',
  '1566910803909541968': 'Warframe',
  '1566910805843255513': 'Destiny 2',
  '1566910809538428938': 'Helldivers 2',
  '1566910811446841484': 'GTA Online',
  '1566910813048930538': 'Monster Hunter Wilds',
  '1566910820548476968': 'Other'
};

const PLATFORM_ROLE_ID_TO_NAME = {
  '1566910823324975107': 'PC',
  '1566910825925447822': 'PlayStation',
  '1566910837384544277': 'Xbox',
  '1566910839964041308': 'Mobile',
  '1566910842803585054': 'Nintendo Switch'
};

const EXPERIENCE_ROLE_ID_TO_NAME = {
  '1566910846532325517': 'Competitive',
  '1566910849422200942': 'Casual',
  '1566910852031062126': 'Co-op',
  '1566910854518280374': 'Survival',
  '1566910856900378815': 'RPG',
  '1566910859442127001': 'Horror',
  '1566910861337960458': 'Social gaming'
};

const PLATFORM_NAME_TO_ROLE_ID = {
  'PC': '1566910823324975107',
  'PlayStation': '1566910825925447822',
  'Xbox': '1566910837384544277',
  'Mobile': '1566910839964041308',
  'Nintendo Switch': '1566910842803585054'
};

const EXPERIENCE_NAME_TO_ROLE_ID = {
  'Competitive': '1566910846532325517',
  'Casual': '1566910849422200942',
  'Co-op': '1566910852031062126',
  'Survival': '1566910854518280374',
  'RPG': '1566910856900378815',
  'Horror': '1566910859442127001',
  'Social gaming': '1566910861337960458'
};

function hasCompletedNativeOnboarding(member) {
  if (!member || !member.roles || !member.roles.cache) return false;
  const roleKeys = Array.from(member.roles.cache.keys());
  const hasGame = roleKeys.some(id => ONBOARDING_GAME_ROLE_IDS.has(id));
  const hasPlatform = roleKeys.some(id => ONBOARDING_PLATFORM_ROLE_IDS.has(id));
  const hasExp = roleKeys.some(id => ONBOARDING_EXPERIENCE_ROLE_IDS.has(id));
  return hasGame || hasPlatform || hasExp;
}

function extractOnboardingAnswersFromMember(member) {
  if (!member || !member.roles || !member.roles.cache) return { games: [], platforms: [], experiences: [] };
  const roleKeys = Array.from(member.roles.cache.keys());
  const games = [];
  const platforms = [];
  const experiences = [];

  for (const rId of roleKeys) {
    if (GAME_ROLE_ID_TO_NAME[rId]) {
      const gName = GAME_ROLE_ID_TO_NAME[rId];
      games.push({ game: gName, slug: gName.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
    }
    if (PLATFORM_ROLE_ID_TO_NAME[rId]) {
      platforms.push(PLATFORM_ROLE_ID_TO_NAME[rId]);
    }
    if (EXPERIENCE_ROLE_ID_TO_NAME[rId]) {
      experiences.push(EXPERIENCE_ROLE_ID_TO_NAME[rId]);
    }
  }

  return { games, platforms, experiences };
}

/**
 * Safe acknowledgement helper that prevents 3-second Discord timeouts
 * and catches 10062 (Unknown Interaction) and 40060 (Already Acknowledged)
 */
async function safeAcknowledge(interaction, type = 'update') {
  if (interaction.replied || interaction.deferred) return true;
  try {
    if (type === 'reply') {
      await interaction.deferReply({ ephemeral: true });
    } else if (type === 'update') {
      await interaction.deferUpdate();
    }
    return true;
  } catch (err) {
    if (err.code === 10062) {
      console.warn(`[InteractionTimeout] Interaction token expired (10062) for ${interaction.customId || interaction.commandName}`);
    } else if (err.code !== 40060) {
      console.warn(`[AcknowledgeError] ${err.message} (code: ${err.code})`);
    }
    return false;
  }
}

/**
 * Delivers ephemeral updates or replies safely regardless of whether
 * interaction was already deferred, replied, or fresh
 */
async function safeEditOrReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    } else {
      return await interaction.reply({ ...payload, ephemeral: true });
    }
  } catch (err) {
    if (err.code === 10062) {
      console.warn(`[InteractionExpired] Could not deliver payload for ${interaction.customId || interaction.commandName} (token expired)`);
    } else {
      console.error(`[EditOrReplyError] ${err.message}`);
    }
  }
}

/**
 * Final role assignment, dynamic channel provisioning, and clean public intro card
 */
async function finish(guild, userId, s) {
  const member = await guild.members.fetch(userId);
  const isMinor = s.answers.age_group === 'minor';

  // 1. Assign Age Role (Teen Member or 18+ Member)
  const ageRoleName = isMinor ? 'Teen Member' : '18+ Member';
  const ageColor = isMinor ? '#E0A526' : '#2ECC71';
  let ageRole = guild.roles.cache.find(x => x.name.toLowerCase() === ageRoleName.toLowerCase())
    || guild.roles.cache.find(x => x.name.toLowerCase() === (isMinor ? 'minor 13-17' : 'adult 18+'))
    || await role(guild, ageRoleName, ageColor);
  if (ageRole) await member.roles.add(ageRole);

  // 2. Dynamic Multiplayer Game Channels & Roles Provisioning
  const createdGameChannels = [];
  if (Array.isArray(s.answers.games)) {
    for (const gItem of s.answers.games) {
      try {
        const slug = gItem.game.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let knownGame = db.getGameBySlug(slug);

        if (!knownGame) {
          db.createGameRequest(gItem.game, 'coop_horror', userId);
          db.logAudit('AUTO_GAME_REQUEST', `Onboarding request for '${gItem.game}'`, userId);
        }

        if (gameManager) {
          await gameManager.addMemberToGame(userId, slug || gItem.game, gItem.platform || 'PC', gItem.skill || 'Intermediate');
          createdGameChannels.push(gItem.game);
        } else {
          const gameRole = await role(guild, `${safe(gItem.game)} Squad`);
          if (gameRole) await member.roles.add(gameRole);
        }
      } catch (err) {
        console.error(`Error provisioning game ${gItem.game}:`, err.message);
      }
    }
  }

  // 3. Timing Roles (Maps All Day to all 5 roles)
  const timingRoles = s.answers.timing_roles || [];
  const timing = (s.answers.timing || '').toLowerCase();
  for (const [needle, roleName] of [
    ['morning', 'Morning Crew'],
    ['late night', 'Night Owls'],
    ['evening', 'Evening Players'],
    ['weekend', 'Weekend Warriors'],
    ['afternoon', 'Afternoon Crew']
  ]) {
    if (timingRoles.includes(needle) || timing.includes(needle)) {
      const r = await role(guild, roleName);
      if (r) await member.roles.add(r);
    }
  }

  // 4. Playstyle Roles (Supports All of them)
  const lookingPrefs = s.answers.looking_preferences || [];
  const wants = (s.answers.looking || '').toLowerCase();
  if (lookingPrefs.includes('Ranked squad') || wants.includes('ranked')) {
    const r = await role(guild, 'Ranked Squad');
    if (r) await member.roles.add(r);
  }
  if (lookingPrefs.includes('Casual friends') || lookingPrefs.includes('Chill VC') || wants.includes('casual') || wants.includes('chill')) {
    const r = await role(guild, 'Casual Chill');
    if (r) await member.roles.add(r);
  }
  if (lookingPrefs.includes('Co-op') || wants.includes('co-op') || wants.includes('coop')) {
    const r = await role(guild, 'Co-op Crew');
    if (r) await member.roles.add(r);
  }

  // 5. Gender Role (Optional - only if explicitly chosen and not skipped)
  if (s.answers.gender && s.answers.gender !== 'Prefer not to say' && s.answers.gender !== 'Skip') {
    const r = await role(guild, s.answers.gender);
    if (r) await member.roles.add(r);
  }

  // 5b. Platform Roles (from Onboarding Question 2)
  if (Array.isArray(s.answers.platforms)) {
    for (const plat of s.answers.platforms) {
      const rId = PLATFORM_NAME_TO_ROLE_ID[plat];
      if (rId) {
        const r = guild.roles.cache.get(rId) || await guild.roles.fetch(rId).catch(() => null);
        if (r && !member.roles.cache.has(r.id)) await member.roles.add(r).catch(() => {});
      }
    }
  }

  // 5c. Experience Roles (from Onboarding Question 3)
  if (Array.isArray(s.answers.experiences)) {
    for (const exp of s.answers.experiences) {
      const rId = EXPERIENCE_NAME_TO_ROLE_ID[exp];
      if (rId) {
        const r = guild.roles.cache.get(rId) || await guild.roles.fetch(rId).catch(() => null);
        if (r && !member.roles.cache.has(r.id)) await member.roles.add(r).catch(() => {});
      }
    }
  }

  // 6. Assign Verified Member role LAST
  let verifiedRole = guild.roles.cache.find(x => x.name.toLowerCase() === 'verified member')
    || guild.roles.cache.find(x => x.name.toLowerCase() === 'verified')
    || await role(guild, 'Verified Member', '#3498DB');
  if (verifiedRole) await member.roles.add(verifiedRole);

  // 7. Introduction Card (numerical age and gender strictly omitted for privacy)
  const intro = guild.channels.cache.find(c => c.name === names.intros)
    || guild.channels.cache.find(c => c.name === 'general-chat');
  if (intro && intro.isTextBased()) {
    const gameListStr = s.answers.games && s.answers.games.length > 0
      ? s.answers.games.map(g => `• **${g.game}** (${g.platform || 'PC'} · ${g.skill || 'Intermediate'})`).join('\n')
      : '• *Exploring community games*';

    const cardContent = [
      `🎮 **NEW AGENT DEPLOYED: ${member.displayName}**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🕹️ **Favorite Games & Platforms:**\n${gameListStr}`,
      `⏰ **Active Hours:** ${s.answers.timing || 'Not specified'}${s.answers.timezone ? ` (${s.answers.timezone})` : ''}`,
      `🎯 **Looking For:** ${s.answers.looking || 'Community & Co-op'}`,
      s.answers.language ? `🗣️ **Voice Language:** ${s.answers.language}` : null,
      `🛡️ **Clearance Level:** Verified Member (${ageRoleName})`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👉 *Head to <#${guild.channels.cache.find(c => c.name === (isMinor ? names.minorLfg : names.adultLfg))?.id || names.verify}> to squad up!*`
    ].filter(Boolean).join('\n');

    await intro.send({
      content: cardContent,
      allowedMentions: { parse: [] }
    });
  }

  // Atomically complete session in SQLite database
  db.completeVerificationSession(guild.id, userId);
  cancelTimer(`${guild.id}:${userId}`);

  // 8. Direct to respective LFG channel
  const targetLfgName = isMinor ? names.minorLfg : names.adultLfg;
  const lfgCh = guild.channels.cache.find(c => c.name === targetLfgName);

  return {
    content: `🎉 **Verification Complete!**\nYour roles have been assigned and you are verified as **${ageRoleName}**.\n👉 Head to <#${lfgCh ? lfgCh.id : names.verify}> to meet teammates!`,
    components: []
  };
}

// Gateway Events
client.on('guildMemberAdd', member => {
  if (member.guild.id !== guildId) return;

  // Automatically assign @Server Bot role to any bot that joins
  if (member.user.bot) {
    const serverBotRole = member.guild.roles.cache.find(r => r.name === '🤖 Server Bot' || r.id === '1567600793547440300');
    if (serverBotRole) {
      member.roles.add(serverBotRole)
        .then(() => console.log(`[BOT_AUTO_ROLE] Successfully assigned @Server Bot to ${member.user.tag}`))
        .catch(err => console.error(`[BOT_AUTO_ROLE_ERR] Could not assign role to ${member.user.tag}:`, err));
    }
    return;
  }

  const isPending = Boolean(member.pending);
  console.log(`[SCREENING_EVENT_RECEIVED] guildMemberAdd — user=${member.user.tag} id=${member.id} pending=${isPending}`);
  db.recordScreeningEvent(member.id, guildId, 'guildMemberAdd', null, isPending);

  if (isPending) {
    console.log(`[SCREENING_EVENT_RECEIVED] Member ${member.user.tag} joined with rules screening pending.`);
    return;
  }

  // Send friendly onboarding Direct Message (DM) to new member
  setTimeout(async () => {
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x00F0FF)
        .setTitle(`👋 Welcome to GAMING SHAMING, ${member.displayName}!`)
        .setDescription([
          'We are glad to have you in our community!',
          '',
          '**To unlock all game lounges & squad channels:**',
          '• **Step 1:** Read our rules in <#924522829490323516>',
          '• **Step 2:** Complete gamer verification in <#1566854065688813688>',
          '• **Step 3:** Equip your game & platform roles in <#1567553522403385425>',
          '',
          'Ready to squad up? Hop into **#looking-for-group** or click **➕・Click to Create VC** to spin up a private room!',
          '',
          '*Game on! 🚀*'
        ].join('\n'))
        .setFooter({ text: 'GAMING SHAMING • Automated Guide' });

      await member.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (_) {}
  }, 3000);

  // If member already completed native onboarding during join flow
  if (hasCompletedNativeOnboarding(member)) {
    console.log(`[ONBOARDING_TRANSITION] Member ${member.user.tag} joined with native onboarding already completed. Triggering Game Gear verification.`);
    begin(member).catch(console.error);
  } else {
    console.log(`[ONBOARDING_WAITING] Member ${member.user.tag} joined. Awaiting completion of the 3 Discord native onboarding questions before triggering Game Gear verification.`);
  }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (newMember.guild.id !== guildId || newMember.user.bot) return;
  const wasPending = Boolean(oldMember.pending);
  const isPending  = Boolean(newMember.pending);

  if (wasPending && !isPending) {
    console.log(`[MEMBER_PENDING_TRANSITION] Member ${newMember.user.tag} completed rules screening.`);
    db.recordScreeningEvent(newMember.id, guildId, 'screening_passed', true, false, { completion_stage: 'rules_screening_complete' });
    db.logAudit('NATIVE_SCREENING_PASSED', `User ${newMember.user.tag} accepted rules.`, newMember.id);

    if (hasCompletedNativeOnboarding(newMember)) {
      console.log(`[ONBOARDING_TRANSITION] Member ${newMember.user.tag} accepted rules and already answered onboarding questions. Triggering Game Gear verification.`);
      begin(newMember).catch(console.error);
    }
  }

  // Detect completion of Discord's 3 Native Onboarding Questions:
  // Transition from not having onboarding roles to having them
  const hadOnboarding = hasCompletedNativeOnboarding(oldMember);
  const hasOnboarding = hasCompletedNativeOnboarding(newMember);

  if (!hadOnboarding && hasOnboarding && !isPending) {
    console.log(`[ONBOARDING_COMPLETED] Member ${newMember.user.tag} completed Discord native onboarding questions! Triggering Game Gear verification.`);
    db.recordScreeningEvent(newMember.id, guildId, 'onboarding_questions_completed', true, false, { completion_stage: 'native_onboarding_questions_complete' });
    db.logAudit('NATIVE_ONBOARDING_COMPLETED', `User ${newMember.user.tag} answered native onboarding questions.`, newMember.id);
    begin(newMember).catch(console.error);
  }
});

// Interaction Router (Buttons, Modals, Select Menus, Slash Commands)
client.on('interactionCreate', async interaction => {
  if (interaction.guildId !== guildId) return;

  // Phase 2: Handle Member Identity Components (Buttons, Modals, Select Menus)
  try {
    const handledComp = await handleMemberIdentityComponents(interaction, db);
    if (handledComp) return;
  } catch (err) {
    console.error('[IdentityComponentError]', err);
  }

  // ── 1. Buttons & Select Menus ─────────────────────────────────────────────
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const customId = interaction.customId;
    const userId = interaction.user.id;

    // Self-Assign Interactive Game & Platform Roles Toggle
    if (customId.startsWith('gamer_role_toggle:')) {
      await safeAcknowledge(interaction, 'reply');
      const roleId = customId.split(':')[1];
      try {
        const member = await interaction.guild.members.fetch(userId);
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
          await safeEditOrReply(interaction, { content: '❌ Game role not found on this server.', components: [] });
          return;
        }
        const hasRole = member.roles.cache.has(roleId);
        if (hasRole) {
          await member.roles.remove(roleId);
          await safeEditOrReply(interaction, {
            content: `➖ **Role Removed:** You no longer have the **@${role.name}** role.`,
            components: []
          });
        } else {
          await member.roles.add(roleId);
          await safeEditOrReply(interaction, {
            content: `✅ **Role Assigned:** You now have the **@${role.name}** role! You will receive squad notifications and LFG pings for this title.`,
            components: []
          });
        }
      } catch (err) {
        console.error('[GamerRoleToggleError]', err);
        await safeEditOrReply(interaction, { content: `❌ Could not update role: ${err.message}`, components: [] });
      }
      return;
    }

    // Hall of Fame & Leaderboard Buttons
    if (customId === 'hall_of_fame_leaderboard') {
      await safeAcknowledge(interaction, 'reply');
      const leaderboard = db.getLeaderboard(10);
      const { embed } = buildLeaderboardEmbed(leaderboard, userId);
      await safeEditOrReply(interaction, { embeds: [embed], components: [] });
      return;
    }

    if (customId === 'hall_of_fame_profile') {
      await safeAcknowledge(interaction, 'reply');
      const p = db.getMemberProfile(userId);
      const badges = db.getUserBadges(userId);
      const leaderboard = db.getLeaderboard(100);
      const rankIndex = leaderboard.findIndex(l => l.user_id === userId) + 1 || 1;
      const { embed } = buildProfileEmbed(interaction.user, p, badges, rankIndex);
      await safeEditOrReply(interaction, { embeds: [embed], components: [] });
      return;
    }

    if (customId === 'hall_of_fame_badges') {
      await safeAcknowledge(interaction, 'reply');
      const allBadges = db.getAllBadges();
      const userBadges = db.getUserBadges(userId);
      const userBadgeIds = new Set(userBadges.map(b => b.slug));

      const badgeList = allBadges.map(b => {
        const owned = userBadgeIds.has(b.slug);
        return `${owned ? '✅' : '🔒'} **${b.name}** (${b.icon})\n> *${b.description}*`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(`🎖️ Achievements & Badges for ${interaction.user.username}`)
        .setDescription(badgeList || 'No badges configured.')
        .setFooter({ text: 'Earn badges through voice lounges, squad LFG, and community events!' });

      await safeEditOrReply(interaction, { embeds: [embed], components: [] });
      return;
    }

    // Co-op Channel Interactive Buttons (Role Toggle & LFG)
    if (customId.startsWith('coop_role_')) {
      await safeAcknowledge(interaction, 'reply');
      const slug = customId.replace('coop_role_', '');
      const g = db.getGameBySlug(slug);
      if (!g || !g.role_id) {
        await safeEditOrReply(interaction, { content: 'Game role not found or not configured.', components: [] });
        return;
      }
      try {
        const member = await interaction.guild.members.fetch(userId);
        const hasRole = member.roles.cache.has(g.role_id);
        if (hasRole) {
          await member.roles.remove(g.role_id);
          await safeEditOrReply(interaction, { content: `➖ Removed squad role **@${g.role_name}**.`, components: [] });
        } else {
          await member.roles.add(g.role_id);
          await safeEditOrReply(interaction, { content: `✅ Assigned squad role **@${g.role_name}**! You are now subscribed to squad pings and discussions.`, components: [] });
        }
      } catch (e) {
        await safeEditOrReply(interaction, { content: `Could not update role: ${e.message}`, components: [] });
      }
      return;
    }

    if (customId.startsWith('coop_lfg_')) {
      await safeAcknowledge(interaction, 'reply');
      const slug = customId.replace('coop_lfg_', '');
      const g = db.getGameBySlug(slug);
      const lfgCh = interaction.guild.channels.cache.get('1567553522403385425') || interaction.guild.channels.cache.find(c => c.name.includes('ooking'));
      const roleMention = g?.role_id ? `<@&${g.role_id}>` : `@${g?.role_name || slug}`;
      await safeEditOrReply(interaction, {
        content: `🎮 Looking for **${g?.name || slug}** teammates? Head over to <#${lfgCh?.id || '1566922336404246568'}> and ping ${roleMention} to squad up!`,
        components: []
      });
      return;
    }

    // Hardware & Deals Feature Handlers
    if (customId === 'toggle_deal_hunter_role') {
      await safeAcknowledge(interaction, 'reply');
      try {
        const member = await interaction.guild.members.fetch(userId);
        const hasRole = member.roles.cache.has(IDS.DEAL_HUNTER_ROLE_ID);
        if (hasRole) {
          await member.roles.remove(IDS.DEAL_HUNTER_ROLE_ID);
          await safeEditOrReply(interaction, {
            content: '🔕 You have unsubscribed from **🔔 Deal Hunter** alerts. You will no longer be pinged on flash hardware deals.',
            components: []
          });
        } else {
          await member.roles.add(IDS.DEAL_HUNTER_ROLE_ID);
          await safeEditOrReply(interaction, {
            content: '✅ You now have the **🔔 Deal Hunter** role! You will be pinged instantly whenever a 70%+ mega hardware loot or price glitch drops.',
            components: []
          });
        }
      } catch (e) {
        await safeEditOrReply(interaction, { content: `Could not update role: ${e.message}`, components: [] });
      }
      return;
    }

    if (customId === 'market_create_listing_prompt') {
      await interaction.showModal(buildMarketModal());
      return;
    }

    if (customId.startsWith('build_preset_')) {
      await safeAcknowledge(interaction, 'reply');
      const key = customId.replace('build_preset_', '');
      const embed = buildPresetEmbed(key);
      if (embed) {
        await safeEditOrReply(interaction, { embeds: [embed], components: [] });
      } else {
        await safeEditOrReply(interaction, { content: 'Build preset not found.', components: [] });
      }
      return;
    }

    // Start / Status entry points
    if (customId === 'verify_start_btn') {
      await safeAcknowledge(interaction, 'reply');

      let member = interaction.member;
      if (!member || !member.roles) {
        try { member = await interaction.guild.members.fetch(userId); } catch (_) {}
      }

      const verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified member');
      const hasVerifiedRole = member?.roles?.cache?.has(verifiedRole?.id);

      const { session } = db.getOrCreateVerificationSession(guildId, userId);
      if (session.status === 'completed' || hasVerifiedRole) {
        await safeEditOrReply(interaction, {
          content: '✅ You are already verified! Head over to community channels to squad up.',
          components: []
        });
        return;
      }
      if (session.status === 'review') {
        await safeEditOrReply(interaction, {
          content: `⏳ Your verification is pending moderator review: ${session.review_reason || 'Under review'}`,
          components: []
        });
        return;
      }

      // Check for native onboarding answers from Discord roles
      const detected = extractOnboardingAnswersFromMember(member);
      const hasNativeAnswers = (detected.games.length > 0 || detected.platforms.length > 0 || detected.experiences.length > 0);

      if (hasNativeAnswers) {
        if (!session.answers.games || session.answers.games.length === 0) {
          session.answers.games = detected.games;
        }
        if (!session.answers.platforms || session.answers.platforms.length === 0) {
          session.answers.platforms = detected.platforms;
        }
        if (!session.answers.experiences || session.answers.experiences.length === 0) {
          session.answers.experiences = detected.experiences;
        }
        if (!session.answers.looking_preferences || session.answers.looking_preferences.length === 0) {
          const mappedLooking = [];
          if (detected.experiences.includes('Competitive')) mappedLooking.push('Ranked squad');
          if (detected.experiences.includes('Casual')) mappedLooking.push('Casual friends');
          if (detected.experiences.includes('Co-op')) mappedLooking.push('Co-op');
          if (detected.experiences.includes('Social gaming')) mappedLooking.push('Chill VC');
          if (mappedLooking.length > 0) {
            session.answers.looking_preferences = mappedLooking;
            session.answers.looking = mappedLooking.join(', ');
          }
        }
      }

      // Resume existing step if in progress, otherwise start directly at Step 1 of 6 (Age Classification)
      if (!session.step || session.step === 'agree' || session.step === 'detected' || session.step === 'not started') {
        session.step = 'age';
      }
      db.updateVerificationSession(guildId, userId, { step: session.step, answers: session.answers });

      const payload = getStepPayload(session, interaction.guild);
      await safeEditOrReply(interaction, payload);
      return;
    }

    if (customId === 'verify_check_status_btn') {
      await safeAcknowledge(interaction, 'reply');
      const s = db.getVerificationSession(guildId, userId);
      let member = interaction.member;
      if (!member || !member.roles) {
        try { member = await interaction.guild.members.fetch(userId); } catch (_) {}
      }
      const verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified member');
      const isVerified = s?.status === 'completed' || member?.roles?.cache?.has(verifiedRole?.id);

      let statusMsg = '';
      if (isVerified) {
        statusMsg = '✅ **Status: Verified**\nYour profile is verified and you have full access to community channels.';
      } else if (s?.status === 'review') {
        statusMsg = `⏳ **Status: Under Review**\nYour verification is pending moderator review: ${s.review_reason || 'Under review'}`;
      } else if (s && s.step && s.step !== 'not started') {
        statusMsg = `⚙️ **Status: In Progress** (Current Step: **${s.step}**)\nClick **Start Verification** above to continue your verification questionnaire.`;
      } else {
        statusMsg = `⚙️ **Status: Not Started**\nYou have not started verification yet. Click **Start Verification** above to begin!`;
      }
      await safeEditOrReply(interaction, { content: statusMsg, components: [] });
      return;
    }

    // Load active session for ongoing questionnaire
    const s = db.getVerificationSession(guildId, userId);
    if (!s || s.status === 'completed' || s.status === 'review') {
      await safeAcknowledge(interaction, 'reply');
      await safeEditOrReply(interaction, { content: 'No active verification in progress. Click **Start Verification** above.', components: [] });
      return;
    }

    // Detected Onboarding Flow Navigation
    if (customId === 'onboard_continue_to_age') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'age' });
      await safeEditOrReply(interaction, buildStepAgePayload());
      return;
    }

    if (customId === 'onboard_edit_prefs') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'games' });
      const allGames = [
        ...db.getGamesByCategory('fps_competitive'),
        ...db.getGamesByCategory('survival_sandbox'),
        ...db.getGamesByCategory('coop_horror')
      ];
      await safeEditOrReply(interaction, buildStepGamesPayload(s.answers.games || [], allGames));
      return;
    }

    // Onboarding Question 2: Platforms
    if (customId === 'onboard_nav_to_platform' || customId === 'verify_nav_to_platform') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'platform' });
      await safeEditOrReply(interaction, buildOnboardingPlatformPayload(s.answers.platforms || []));
      return;
    }

    if (customId === 'onboard_nav_back_to_games') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'games' });
      const allGames = [
        ...db.getGamesByCategory('fps_competitive'),
        ...db.getGamesByCategory('survival_sandbox'),
        ...db.getGamesByCategory('coop_horror')
      ];
      await safeEditOrReply(interaction, buildStepGamesPayload(s.answers.games || [], allGames));
      return;
    }

    if (customId.startsWith('onboard_plat_')) {
      await safeAcknowledge(interaction, 'update');
      const platKey = customId.replace('onboard_plat_', '');
      const codeToName = {
        pc: 'PC',
        playstation: 'PlayStation',
        xbox: 'Xbox',
        mobile: 'Mobile',
        nintendoswitch: 'Nintendo Switch'
      };
      const platName = codeToName[platKey] || platKey;
      if (!s.answers.platforms) s.answers.platforms = [];
      if (s.answers.platforms.includes(platName)) {
        s.answers.platforms = s.answers.platforms.filter(p => p !== platName);
      } else {
        s.answers.platforms.push(platName);
      }
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildOnboardingPlatformPayload(s.answers.platforms));
      return;
    }

    // Onboarding Question 3: Experiences
    if (customId === 'onboard_nav_to_experience') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'experience' });
      await safeEditOrReply(interaction, buildOnboardingExperiencePayload(s.answers.experiences || []));
      return;
    }

    if (customId === 'onboard_nav_back_to_platform') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'platform' });
      await safeEditOrReply(interaction, buildOnboardingPlatformPayload(s.answers.platforms || []));
      return;
    }

    if (customId.startsWith('onboard_exp_')) {
      await safeAcknowledge(interaction, 'update');
      const expKey = customId.replace('onboard_exp_', '');
      const codeToExp = {
        comp: 'Competitive',
        casual: 'Casual',
        coop: 'Co-op',
        survival: 'Survival',
        rpg: 'RPG',
        horror: 'Horror',
        social: 'Social gaming'
      };
      const expName = codeToExp[expKey] || expKey;
      if (!s.answers.experiences) s.answers.experiences = [];
      if (s.answers.experiences.includes(expName)) {
        s.answers.experiences = s.answers.experiences.filter(e => e !== expName);
      } else {
        s.answers.experiences.push(expName);
      }
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildOnboardingExperiencePayload(s.answers.experiences));
      return;
    }

    if (customId === 'onboard_nav_to_age') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'age' });
      await safeEditOrReply(interaction, buildStepAgePayload());
      return;
    }

    // Step 1: Age Classification
    if (customId === 'verify_age_adult') {
      await safeAcknowledge(interaction, 'update');
      s.answers.age_group = 'adult';
      s.answers.age_confirmed = true;
      delete s.answers.age;
      db.updateVerificationSession(guildId, userId, { step: 'gender', answers: s.answers });
      await safeEditOrReply(interaction, buildStepGenderPayload());
      return;
    }

    if (customId === 'verify_age_minor') {
      await safeAcknowledge(interaction, 'update');
      s.answers.age_group = 'minor';
      s.answers.age_confirmed = true;
      delete s.answers.age;
      db.updateVerificationSession(guildId, userId, { step: 'gender', answers: s.answers });
      await safeEditOrReply(interaction, buildStepGenderPayload());
      return;
    }

    if (customId === 'verify_age_custom_modal') {
      // Modals must NOT be deferred!
      await interaction.showModal(buildAgeInputModal());
      return;
    }

    // Step 2: Gender -> transitions to Step 3: Games
    if (customId.startsWith('verify_gender_')) {
      await safeAcknowledge(interaction, 'update');
      const gChoice = customId.replace('verify_gender_', '');
      if (gChoice === 'skip' || gChoice === 'pnts') {
        s.answers.gender = null;
      } else if (gChoice === 'male') {
        s.answers.gender = 'Male';
      } else if (gChoice === 'female') {
        s.answers.gender = 'Female';
      } else if (gChoice === 'nb') {
        s.answers.gender = 'Non-binary';
      }
      db.updateVerificationSession(guildId, userId, { step: 'games', answers: s.answers });
      const allGames = [
        ...db.getGamesByCategory('fps_competitive'),
        ...db.getGamesByCategory('survival_sandbox'),
        ...db.getGamesByCategory('coop_horror')
      ];
      await safeEditOrReply(interaction, buildStepGamesPayload(s.answers.games || [], allGames));
      return;
    }

    // Step 3: Games selection
    if (customId === 'verify_games_dropdown') {
      await safeAcknowledge(interaction, 'update');
      const selectedSlugs = interaction.values;
      if (!s.answers.games) s.answers.games = [];
      const newlyAdded = [];

      for (const slug of selectedSlugs) {
        const g = db.getGameBySlug(slug);
        const name = g ? g.name : slug;
        if (!s.answers.games.some(x => x.game.toLowerCase() === name.toLowerCase())) {
          const item = { game: name, slug, missingPlatform: true, missingSkill: true };
          s.answers.games.push(item);
          newlyAdded.push(item);
        }
      }

      db.updateVerificationSession(guildId, userId, { answers: s.answers });

      const needsPlat = s.answers.games.find(g => !g.platform);
      if (needsPlat) {
        await safeEditOrReply(interaction, buildMissingPlatformSkillPayload(needsPlat.game));
      } else {
        const allGames = [
          ...db.getGamesByCategory('fps_competitive'),
          ...db.getGamesByCategory('survival_sandbox'),
          ...db.getGamesByCategory('coop_horror')
        ];
        await safeEditOrReply(interaction, buildStepGamesPayload(s.answers.games, allGames));
      }
      return;
    }

    // Game platform selection
    if (customId.startsWith('game_plat_')) {
      await safeAcknowledge(interaction, 'update');
      const parts = customId.split('_');
      const platCode = parts[2];
      const gName = parts.slice(3).join('_');

      const platMap = { pc: 'PC', ps: 'PlayStation', xbox: 'Xbox', mobile: 'Mobile', switch: 'Nintendo Switch' };
      const chosenPlat = platMap[platCode] || 'PC';

      const targetGame = s.answers.games?.find(g => g.game.toLowerCase() === gName.toLowerCase());
      if (targetGame) {
        targetGame.platform = chosenPlat;
        targetGame.missingPlatform = false;
        db.updateVerificationSession(guildId, userId, { answers: s.answers });
      }

      await safeEditOrReply(interaction, buildMissingSkillPayload(gName, chosenPlat));
      return;
    }

    // Game skill selection
    if (customId.startsWith('game_skill_')) {
      await safeAcknowledge(interaction, 'update');
      const parts = customId.split('_');
      const skillCode = parts[2];
      const gName = parts.slice(3).join('_');

      const skillMap = { beg: 'Beginner', inter: 'Intermediate', comp: 'Competitive' };
      const chosenSkill = skillMap[skillCode] || 'Intermediate';

      const targetGame = s.answers.games?.find(g => g.game.toLowerCase() === gName.toLowerCase());
      if (targetGame) {
        targetGame.skill = chosenSkill;
        targetGame.missingSkill = false;
        db.updateVerificationSession(guildId, userId, { answers: s.answers });
      }

      const nextUnconfigured = s.answers.games?.find(g => !g.platform);
      if (nextUnconfigured) {
        await safeEditOrReply(interaction, buildMissingPlatformSkillPayload(nextUnconfigured.game));
      } else {
        const allGames = [
          ...db.getGamesByCategory('fps_competitive'),
          ...db.getGamesByCategory('survival_sandbox'),
          ...db.getGamesByCategory('coop_horror')
        ];
        await safeEditOrReply(interaction, buildStepGamesPayload(s.answers.games || [], allGames));
      }
      return;
    }

    if (customId === 'verify_games_modal_btn') {
      const modal = new ModalBuilder().setCustomId('modal_games_submit').setTitle('Add Games');
      const gameInput = new TextInputBuilder()
        .setCustomId('games_text_input')
        .setLabel('Type your games (e.g. Apex, Minecraft):')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Apex Legends — PC — Pro\nMinecraft\nValorant')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(gameInput));
      await interaction.showModal(modal);
      return;
    }

    // Step 4: Timing & Timezone
    if (customId === 'verify_timing_allday') {
      await safeAcknowledge(interaction, 'update');
      const parsed = parseSchedule('All day');
      s.answers.timing = parsed.displayTiming;
      s.answers.timing_roles = parsed.timings;
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
      return;
    }

    if (customId === 'verify_timing_evenings') {
      await safeAcknowledge(interaction, 'update');
      const parsed = parseSchedule('Evenings');
      s.answers.timing = parsed.displayTiming;
      s.answers.timing_roles = parsed.timings;
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
      return;
    }

    if (customId === 'verify_timing_weekends') {
      await safeAcknowledge(interaction, 'update');
      const parsed = parseSchedule('Weekends');
      s.answers.timing = parsed.displayTiming;
      s.answers.timing_roles = parsed.timings;
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
      return;
    }

    if (customId === 'verify_timing_nights') {
      await safeAcknowledge(interaction, 'update');
      const parsed = parseSchedule('Late Night');
      s.answers.timing = parsed.displayTiming;
      s.answers.timing_roles = parsed.timings;
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
      return;
    }

    if (customId.startsWith('verify_tz_')) {
      await safeAcknowledge(interaction, 'update');
      const tzCode = customId.replace('verify_tz_', '');
      const tzMap = { ist: 'IST (UTC+5:30)', est: 'EST (UTC-5)', pst: 'PST (UTC-8)', utc: 'UTC / GMT' };
      s.answers.timezone = tzMap[tzCode] || 'UTC';
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
      return;
    }

    if (customId === 'verify_timing_modal_btn') {
      const modal = new ModalBuilder().setCustomId('modal_timing_submit').setTitle('Custom Schedule & Timezone');
      const input = new TextInputBuilder()
        .setCustomId('timing_text_input')
        .setLabel('When do you play? (e.g. All day, Evenings):')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Evenings and weekends — IST (UTC+5:30)')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // Step 5: Looking For
    if (customId === 'verify_look_all') {
      await safeAcknowledge(interaction, 'update');
      s.answers.looking_preferences = ['Casual friends', 'Ranked squad', 'Chill VC', 'Co-op'];
      s.answers.looking = s.answers.looking_preferences.join(', ');
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildStepLookingPayload(s.answers.looking_preferences));
      return;
    }

    if (customId.startsWith('verify_look_')) {
      await safeAcknowledge(interaction, 'update');
      const lookMap = {
        casual: 'Casual friends',
        ranked: 'Ranked squad',
        chill: 'Chill VC',
        coop: 'Co-op'
      };
      const key = customId.replace('verify_look_', '');
      const choice = lookMap[key];
      if (choice) {
        if (!s.answers.looking_preferences) s.answers.looking_preferences = [];
        if (s.answers.looking_preferences.includes(choice)) {
          s.answers.looking_preferences = s.answers.looking_preferences.filter(x => x !== choice);
        } else {
          s.answers.looking_preferences.push(choice);
        }
        s.answers.looking = s.answers.looking_preferences.join(', ');
        db.updateVerificationSession(guildId, userId, { answers: s.answers });
        await safeEditOrReply(interaction, buildStepLookingPayload(s.answers.looking_preferences));
      }
      return;
    }

    // Step 6: Language
    if (customId === 'verify_lang_en') {
      await safeAcknowledge(interaction, 'update');
      s.answers.language = 'English';
      db.updateVerificationSession(guildId, userId, { step: 'confirm', answers: s.answers });
      await safeEditOrReply(interaction, buildConfirmationPayload(s.answers));
      return;
    }
    if (customId === 'verify_lang_hi') {
      await safeAcknowledge(interaction, 'update');
      s.answers.language = 'Hindi';
      db.updateVerificationSession(guildId, userId, { step: 'confirm', answers: s.answers });
      await safeEditOrReply(interaction, buildConfirmationPayload(s.answers));
      return;
    }
    if (customId === 'verify_lang_es') {
      await safeAcknowledge(interaction, 'update');
      s.answers.language = 'Spanish';
      db.updateVerificationSession(guildId, userId, { step: 'confirm', answers: s.answers });
      await safeEditOrReply(interaction, buildConfirmationPayload(s.answers));
      return;
    }
    if (customId === 'verify_lang_skip') {
      await safeAcknowledge(interaction, 'update');
      s.answers.language = null;
      db.updateVerificationSession(guildId, userId, { step: 'confirm', answers: s.answers });
      await safeEditOrReply(interaction, buildConfirmationPayload(s.answers));
      return;
    }
    if (customId === 'verify_lang_modal_btn') {
      const modal = new ModalBuilder().setCustomId('modal_language_submit').setTitle('Voice Language');
      const input = new TextInputBuilder()
        .setCustomId('lang_text_input')
        .setLabel('Primary voice chat language:')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. English, French, Japanese')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // Navigation & Final Confirmation
    if (customId === 'verify_nav_to_timing') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'timing' });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
      return;
    }
    if (customId === 'verify_nav_to_looking') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'looking' });
      await safeEditOrReply(interaction, buildStepLookingPayload(s.answers.looking_preferences || []));
      return;
    }
    if (customId === 'verify_nav_to_language') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'language' });
      await safeEditOrReply(interaction, buildStepLanguagePayload(s.answers.language));
      return;
    }
    if (customId === 'verify_nav_to_confirm') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'confirm' });
      await safeEditOrReply(interaction, buildConfirmationPayload(s.answers));
      return;
    }
    if (customId === 'verify_nav_back_to_age') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'age' });
      await safeEditOrReply(interaction, buildStepAgePayload());
      return;
    }
    if (customId === 'verify_nav_back_to_gender') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'gender' });
      await safeEditOrReply(interaction, buildStepGenderPayload());
      return;
    }
    if (customId === 'verify_nav_back_to_games') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'games' });
      const allGames = [
        ...db.getGamesByCategory('fps_competitive'),
        ...db.getGamesByCategory('survival_sandbox'),
        ...db.getGamesByCategory('coop_horror')
      ];
      await safeEditOrReply(interaction, buildStepGamesPayload(s.answers.games || [], allGames));
      return;
    }
    if (customId === 'verify_nav_back_to_timing') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'timing' });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
      return;
    }
    if (customId === 'verify_nav_back_to_looking') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'looking' });
      await safeEditOrReply(interaction, buildStepLookingPayload(s.answers.looking_preferences || []));
      return;
    }

    if (customId === 'verify_final_edit_btn') {
      await safeAcknowledge(interaction, 'update');
      db.updateVerificationSession(guildId, userId, { step: 'age' });
      await safeEditOrReply(interaction, buildStepAgePayload());
      return;
    }

    if (customId === 'verify_cancel_btn') {
      await safeAcknowledge(interaction, 'update');
      await safeEditOrReply(interaction, { content: 'Verification cancelled. You can restart anytime by clicking **Start Verification** in #verify.', components: [] });
      return;
    }

    // FINAL SUBMISSION CONFIRMATION
    if (customId === 'verify_final_confirm_btn') {
      await safeAcknowledge(interaction, 'update');
      try {
        const finishRes = await finish(interaction.guild, userId, s);
        await safeEditOrReply(interaction, finishRes);
      } catch (err) {
        console.error('Finish verification error:', err);
        await alertMods(interaction.guild, `Role assignment failed for <@${userId}>: ${err.message}`);
        await safeEditOrReply(interaction, { content: `⚠️ A role assignment issue occurred. Moderators have been notified to review your clearance.`, components: [] });
      }
      return;
    }
  }

  // ── 2. Modal Submissions ──────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    const userId = interaction.user.id;

    if (customId === 'market_sell_modal') {
      await safeAcknowledge(interaction, 'reply');
      try {
        const data = {
          type: interaction.fields.getTextInputValue('market_type').trim(),
          item: interaction.fields.getTextInputValue('market_item').trim(),
          price: interaction.fields.getTextInputValue('market_price').trim(),
          condition: interaction.fields.getTextInputValue('market_condition').trim(),
          location: interaction.fields.getTextInputValue('market_location').trim()
        };

        const marketCh = interaction.guild.channels.cache.get(IDS.MARKETPLACE_CHANNEL_ID) || interaction.guild.channels.cache.find(c => c.name.includes('arket'));
        if (marketCh && marketCh.isTextBased()) {
          const embed = formatMarketEmbed(data, interaction.user);
          const post = await marketCh.send({ embeds: [embed] });

          const cleanItem = data.item.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Gear';
          await post.startThread({
            name: `💬 Inquiry - ${cleanItem.slice(0, 35)}`,
            autoArchiveDuration: 1440
          }).catch(() => {});

          await safeEditOrReply(interaction, {
            content: `✅ Your marketplace listing for **${data.item}** has been published in <#${marketCh.id}>!\n⚠️ **Reminder:** Please reply in your thread with a handwritten timestamp photo (\`Username\` + \`GAMING SHAMING\` + \`Date\`) to verify ownership.`,
            components: []
          });
        } else {
          await safeEditOrReply(interaction, { content: 'Marketplace channel could not be found.', components: [] });
        }
      } catch (err) {
        console.error('Market modal error:', err);
        await safeEditOrReply(interaction, { content: `Error creating listing: ${err.message}`, components: [] });
      }
      return;
    }

    const s = db.getVerificationSession(guildId, userId);
    if (!s) return;

    await safeAcknowledge(interaction, 'reply');

    if (customId === 'modal_age_submit') {
      const rawAge = interaction.fields.getTextInputValue('age_number_input').trim();
      const res = validateAgeInput(rawAge);
      if (!res.valid) {
        if (res.isUnderage) {
          db.setVerificationSessionReview(guildId, userId, 'Self-reported age below 13; verification stopped.');
          await alertMods(interaction.guild, `Under-13 self-report from <@${userId}>. Verification stopped; moderator review required.`);
        }
        await safeEditOrReply(interaction, { content: `❌ ${res.error}`, components: [] });
        return;
      }

      s.answers.age_group = res.ageGroup;
      s.answers.age_confirmed = true;
      delete s.answers.age;
      db.updateVerificationSession(guildId, userId, { step: 'gender', answers: s.answers });
      await safeEditOrReply(interaction, buildStepGenderPayload());
      return;
    }

    if (customId === 'modal_games_submit') {
      const text = interaction.fields.getTextInputValue('games_text_input');
      const parsed = parseGamesNatural(text);
      if (!s.answers.games) s.answers.games = [];

      for (const g of parsed.games) {
        if (!s.answers.games.some(x => x.game.toLowerCase() === g.game.toLowerCase())) {
          s.answers.games.push(g);
        }
      }
      db.updateVerificationSession(guildId, userId, { answers: s.answers });

      const needsPlat = s.answers.games.find(g => !g.platform);
      if (needsPlat) {
        await safeEditOrReply(interaction, buildMissingPlatformSkillPayload(needsPlat.game));
      } else {
        const allGames = [
          ...db.getGamesByCategory('fps_competitive'),
          ...db.getGamesByCategory('survival_sandbox'),
          ...db.getGamesByCategory('coop_horror')
        ];
        await safeEditOrReply(interaction, buildStepGamesPayload(s.answers.games, allGames));
      }
      return;
    }

    if (customId === 'modal_timing_submit') {
      const text = interaction.fields.getTextInputValue('timing_text_input');
      const parsed = parseSchedule(text);
      s.answers.timing = parsed.displayTiming;
      s.answers.timing_roles = parsed.timings;
      if (parsed.timezone) s.answers.timezone = parsed.timezone;
      db.updateVerificationSession(guildId, userId, { answers: s.answers });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
      return;
    }

    if (customId === 'modal_language_submit') {
      const text = interaction.fields.getTextInputValue('lang_text_input').trim();
      s.answers.language = text || null;
      db.updateVerificationSession(guildId, userId, { step: 'confirm', answers: s.answers });
      await safeEditOrReply(interaction, buildConfirmationPayload(s.answers));
      return;
    }
  }

  // ── 3. Slash Commands ─────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  // Phase 2: Handle Member Identity Slash Commands (/profile, /setup-profile, /edit-profile, /badges, /rank, /leaderboard)
  try {
    const handledIdentity = await handleMemberIdentityCommands(interaction, db);
    if (handledIdentity) return;
  } catch (err) {
    console.error('[IdentityCommandError]', err);
  }

  if (interaction.commandName === 'games') {
    if (gameManager) {
      await handleGameCommands(interaction, gameManager);
    } else {
      await safeAcknowledge(interaction, 'reply');
      await safeEditOrReply(interaction, { content: 'Game manager is initializing. Please try again shortly.', components: [] });
    }
    return;
  }

  if (interaction.commandName === 'verification-status') {
    await safeAcknowledge(interaction, 'reply');
    const s = db.getVerificationSession(guildId, interaction.user.id);
    await safeEditOrReply(interaction, {
      content: s?.status === 'completed'
        ? '✅ Your profile is confirmed.'
        : s?.status === 'review'
        ? `⏳ Your verification is pending moderator review: ${s.review_reason || 'Under review'}`
        : '⚙️ You are not verified yet. Click **Start Verification** in #verify.',
      components: []
    });
    return;
  }

  if (interaction.commandName === 'review-pending') {
    await safeAcknowledge(interaction, 'reply');
    const reviewSessions = db.getAllActiveVerificationSessions(guildId)
      .filter(s => s.status === 'review')
      .map(s => `<@${s.user_id}> — ${s.review_reason || 'Pending review'}`);
    const gameReqs = db.getPendingRequests().map(r => `[Request #${r.id}] **${r.game_name}** (<@${r.requested_by_user_id}>)`);
    const allPending = [...reviewSessions, ...gameReqs];
    await safeEditOrReply(interaction, {
      content: allPending.length ? allPending.join('\n') : 'No members or game requests awaiting review.',
      components: []
    });
    return;
  }

  if (interaction.commandName === 'setup-verification') {
    await safeAcknowledge(interaction, 'reply');
    try {
      const rulesCh = interaction.guild.channels.cache.find(c => c.name === names.rules);
      const verifyCh = interaction.guild.channels.cache.find(c => c.name === names.verify);
      if (verifyCh && verifyCh.isTextBased()) {
        const welcome = buildPublicVerifyWelcome(rulesCh ? rulesCh.id : undefined);
        await verifyCh.send({
          content: welcome.content,
          components: welcome.components
        });
      }
      await safeEditOrReply(interaction, { content: 'Posted public Start Verification welcome card in #verify.', components: [] });
    } catch (e) {
      await safeEditOrReply(interaction, { content: `Setup notice: ${e.message}`, components: [] });
    }
    return;
  }

  // ── Hardware & Community Features Slash Commands ───────────────────────────
  if (interaction.commandName === 'build') {
    await safeAcknowledge(interaction, 'reply');
    const budget = interaction.options.getString('budget') || '50k';
    const embed = buildPresetEmbed(budget);
    if (embed) {
      await safeEditOrReply(interaction, { embeds: [embed], components: [] });
    } else {
      await safeEditOrReply(interaction, { content: 'Please select a valid budget preset: 30k, 50k, 80k, 120k, 200k', components: [] });
    }
    return;
  }

  if (interaction.commandName === 'setup-leaderboard') {
    await safeAcknowledge(interaction, 'reply');
    try {
      const setupCh = interaction.guild.channels.cache.get(IDS.RATE_SETUP_CHANNEL_ID) || interaction.guild.channels.cache.find(c => c.name.includes('ate-'));
      if (!setupCh || !setupCh.isTextBased()) {
        await safeEditOrReply(interaction, { content: 'Rate My Setup channel not found.', components: [] });
        return;
      }
      const msgs = await setupCh.messages.fetch({ limit: 100 });
      const rated = [];
      for (const m of msgs.values()) {
        const react10 = m.reactions.cache.get('🔟');
        const count = react10 ? react10.count - (react10.me ? 1 : 0) : 0;
        if (count > 0 && !m.author.bot) {
          const img = m.attachments.first()?.url || m.content.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)/i)?.[0];
          rated.push({
            author: m.author,
            count,
            url: m.url,
            img
          });
        }
      }
      rated.sort((a, b) => b.count - a.count);
      const top5 = rated.slice(0, 5);

      if (top5.length === 0) {
        await safeEditOrReply(interaction, {
          content: '🏆 No setups rated with 🔟 yet in <#' + setupCh.id + '>! Post your battlestation to be the first champion.',
          components: []
        });
        return;
      }

      const desc = top5.map((s, idx) => {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        return `${medals[idx]} **<@${s.author.id}>** — **${s.count}** God Tier Votes (🔟)\n> 🔗 [View Battlestation](${s.url})`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🏆 RATE MY SETUP // COMMUNITY HALL OF FAME')
        .setDescription(desc)
        .setFooter({ text: 'Voted by the community with 🔟 God Tier reactions • GAMING SHAMING' })
        .setTimestamp();

      if (top5[0]?.img) embed.setImage(top5[0].img);

      await safeEditOrReply(interaction, { embeds: [embed], components: [] });
    } catch (e) {
      await safeEditOrReply(interaction, { content: `Error fetching leaderboard: ${e.message}`, components: [] });
    }
    return;
  }

  if (interaction.commandName === 'crown-king') {
    await safeAcknowledge(interaction, 'reply');
    try {
      const targetUser = interaction.options.getUser('user');
      const targetMember = await interaction.guild.members.fetch(targetUser.id);
      const kingRole = interaction.guild.roles.cache.get(IDS.BATTLESTATION_KING_ROLE_ID);
      if (!kingRole) {
        await safeEditOrReply(interaction, { content: 'Battlestation King role not found.', components: [] });
        return;
      }

      // Remove from existing holders
      for (const m of kingRole.members.values()) {
        if (m.id !== targetMember.id) {
          await m.roles.remove(kingRole).catch(() => {});
        }
      }

      await targetMember.roles.add(kingRole);

      const crownEmbed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('👑 NEW BATTLESTATION KING CROWNED!')
        .setDescription([
          `Hail the new champion of **#rate-my-setup**!`,
          '',
          `🏆 **<@${targetMember.id}>** has been crowned with the official **@Battlestation King** role!`,
          '',
          'Their rig stands as the highest-voted battlestation in the server. Check out their setup in <#' + IDS.RATE_SETUP_CHANNEL_ID + '>!'
        ].join('\n'))
        .setThumbnail(targetMember.displayAvatarURL())
        .setFooter({ text: 'GAMING SHAMING • Battlestation Royalty' })
        .setTimestamp();

      const setupCh = interaction.guild.channels.cache.get(IDS.RATE_SETUP_CHANNEL_ID);
      if (setupCh && setupCh.isTextBased()) {
        await setupCh.send({ embeds: [crownEmbed] }).catch(() => {});
      }

      await safeEditOrReply(interaction, {
        content: `👑 Successfully crowned <@${targetMember.id}> as the **Battlestation King**!`,
        embeds: [crownEmbed],
        components: []
      });
    } catch (e) {
      await safeEditOrReply(interaction, { content: `Error crowning user: ${e.message}`, components: [] });
    }
    return;
  }
});

// Message Router: Verification privacy guard & Rate My Setup auto-reactions
client.on('messageCreate', async msg => {
  if (!msg.guild || msg.guild.id !== guildId || msg.author.bot) return;

  // Rate My Setup Auto-Reactions (10, 8, 6, 4, Dead) & Discussion Thread
  if (msg.channel.id === '1567632407803330581' || msg.channel.name.includes('ate-')) {
    const hasImage = msg.attachments.size > 0 || msg.content.match(/https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i);
    if (hasImage) {
      try {
        // Auto-react rating scale
        await msg.react('🔟'); // 10/10 God Tier
        await msg.react('8️⃣'); // 8/10 Clean
        await msg.react('6️⃣'); // 6/10 Respectable
        await msg.react('4️⃣'); // 4/10 Budget Grind
        await msg.react('💀'); // Dead / Needs Cable Management

        // Automatically create a discussion thread for specs and advice
        const cleanAuthor = msg.author.displayName.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Gamer';
        await msg.startThread({
          name: `💬 ${cleanAuthor}'s Setup Discussion`,
          autoArchiveDuration: 1440 // 24 hours
        }).catch(() => {});
        console.log(`[RATE_SETUP] Added rating scale and thread for ${msg.author.tag}`);
      } catch (err) {
        console.warn('[RATE_SETUP_ERROR]', err.message);
      }
    }
    return;
  }

  // PC Build Advice Consultation Auto-Thread
  if (msg.channel.id === IDS.BUILD_ADVICE_CHANNEL_ID || msg.channel.name.includes('uild-')) {
    const isQuestion = msg.content.includes('?') || /\b(build|budget|spec|bottleneck|upgrade|gpu|cpu|ram|motherboard|psu|pc|recommend|parts)\b/i.test(msg.content);
    if (isQuestion) {
      try {
        const cleanAuthor = msg.author.displayName.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Gamer';
        await msg.startThread({
          name: `💬 ${cleanAuthor}'s Rig Consultation`,
          autoArchiveDuration: 1440
        }).catch(() => {});
        console.log(`[BUILD_ADVICE] Created consultation thread for ${msg.author.tag}`);
      } catch (err) {
        console.warn('[BUILD_ADVICE_THREAD_WARN]', err.message);
      }
    }
    return;
  }

  if (msg.channel.name !== names.verify) return;

  // Privacy Protection: Only delete if message matches an actual sensitive disclosure pattern
  // (does not delete ordinary conversation like "I play Apex 2" or "need 5 teammates")
  const text = msg.content.trim();
  const leakCheck = detectSensitiveLeak(text);

  if (leakCheck.isLeak && msg.deletable) {
    await msg.delete().catch(() => {});
    const reply = await msg.channel.send({
      content: `🔒 <@${msg.author.id}> For your personal privacy, verification answers are kept private.\nPlease click the **Start Verification** button in the pinned message above to open your private questionnaire.`,
      allowedMentions: { parse: [], users: [msg.author.id] }
    }).catch(() => {});

    if (reply) {
      setTimeout(() => reply.delete().catch(() => {}), 15000);
    }
  }
});

// Auto-Voice ("Join to Create") temporary squad voice channels tracking
const tempVoiceChannels = new Set();

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const member = newState.member;
    const guild = newState.guild || oldState.guild;
    if (!guild || !member || member.user.bot) return;

    // 1. User joins the "Join to Create" generator channel
    if (newState.channel && (newState.channel.name.includes('Click to Create') || newState.channel.name.includes('Join to Create'))) {
      const parentCategory = newState.channel.parent;
      const cleanName = member.displayName.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Gamer';
      
      const tempChannel = await guild.channels.create({
        name: `🎮・${cleanName}'s Squad`,
        type: ChannelType.GuildVoice,
        parent: parentCategory ? parentCategory.id : undefined,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak
            ]
          }
        ],
        reason: `Auto-Voice dynamic squad channel for ${member.displayName}`
      });

      tempVoiceChannels.add(tempChannel.id);
      console.log(`[AUTO_VOICE] Created temporary VC "${tempChannel.name}" (${tempChannel.id}) for ${member.displayName}`);

      // Move member into their new temporary channel
      await member.voice.setChannel(tempChannel);

      // Send squad owner guidance in the voice channel text chat
      setTimeout(async () => {
        try {
          const welcomeEmbed = new EmbedBuilder()
            .setColor(0x00F0FF)
            .setTitle(`🎮 Welcome to your squad room, ${member.displayName}!`)
            .setDescription([
              'You have been granted **Manage Channel** controls for this room:',
              '• Click the **⚙️ Edit Channel** icon to rename your room or set a user limit (e.g. 2 for Duo, 3 for Trio).',
              '• This room will **automatically delete** when everyone leaves.',
              '',
              'Have fun and game on! 🚀'
            ].join('\n'))
            .setFooter({ text: 'GAMER GEAR // Auto-Voice Engine' });

          await tempChannel.send({ embeds: [welcomeEmbed] }).catch(() => {});
        } catch (_) {}
      }, 1000);
    }

    // 2. User leaves a temporary channel
    if (oldState.channel && tempVoiceChannels.has(oldState.channel.id)) {
      const oldCh = oldState.channel;
      // If no members are left in the temporary channel, delete it
      if (oldCh.members.size === 0) {
        tempVoiceChannels.delete(oldCh.id);
        console.log(`[AUTO_VOICE] Deleting empty temporary VC "${oldCh.name}" (${oldCh.id})`);
        await oldCh.delete('Temporary Auto-Voice channel empty').catch(err => {
          console.warn(`[AUTO_VOICE] Could not delete empty VC:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('[AUTO_VOICE_ERROR]', err);
  }
});

client.once('clientReady', async () => {
  console.log(`[Verification & Games] Logged in as ${client.user.tag}`);
  console.log(`[STARTUP] Bot connected to Discord. Guild ID target: ${guildId}`);

    // Dynamic Esports Presence Rotation
    const presenceList = [
      { name: '🎮 /lfg • Squad Matchmaking', type: ActivityType.Playing },
      { name: '💻 60%+ PC Gear Loots', type: ActivityType.Watching },
      { name: '🖥️ /build • Indian PC Advisor', type: ActivityType.Playing },
      { name: '👑 /setup-leaderboard', type: ActivityType.Listening }
    ];
    let pIdx = 0;
    const rotatePresence = () => {
      const p = presenceList[pIdx % presenceList.length];
      client.user.setPresence({ activities: [p], status: 'online' });
      pIdx++;
    };
    rotatePresence();
    setInterval(rotatePresence, 60 * 1000);
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: allCommands });
    console.log(`[Verification & Games] Registered ${allCommands.length} guild slash commands.`);

    const guild = await client.guilds.fetch(guildId);
    gameManager = new DynamicGameManager(guild, db);
    console.log(`[Verification & Games] Dynamic Game Manager initialized with SQLite storage.`);

    // Restore timers from SQLite for all active in_progress sessions
    const activeSessions = db.getAllActiveVerificationSessions(guildId);
    console.log(`[STARTUP] Restoring timers for ${activeSessions.length} in-progress verification session(s) from SQLite.`);
    for (const session of activeSessions) {
      scheduleTimers(guild, session.user_id);
    }

    // Start automated Steam & Epic deals polling (every 2 hours)
    setTimeout(() => pollLiveGameDeals(guild), 15 * 1000);
    setInterval(() => pollLiveGameDeals(guild), 2 * 60 * 60 * 1000);

    // Automated Live Server Stats channels sync (every 10 minutes)
    setTimeout(() => updateServerStats(guild), 30 * 1000);
    setInterval(() => updateServerStats(guild), 10 * 60 * 1000);

    // Automated Daily 6:00 PM Gaming Meme Drop check (every 15 minutes)
    setTimeout(() => checkDailyMemeDrop(guild), 45 * 1000);
    setInterval(() => checkDailyMemeDrop(guild), 15 * 60 * 1000);

    // Automated Reddit LFG feed polling (every 1 hour)
    setTimeout(() => pollRedditLfgFeed(guild), 60 * 1000);
    setInterval(() => pollRedditLfgFeed(guild), 60 * 60 * 1000);

    // Automated PC Hardware & Gear Deals polling (every 1 hour)
    setTimeout(() => pollPCHardwareDeals(guild), 75 * 1000);
    setInterval(() => pollPCHardwareDeals(guild), 60 * 60 * 1000);

    // Auto-Voice: Ensure generator channel exists and clean up any orphaned empty squad rooms
    try {
      const gamingCat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && (c.name.includes('GAMING') || c.id === '1567553467357204560'));
      const existingGenerator = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && (c.name.includes('Click to Create') || c.name.includes('Join to Create')));
      if (!existingGenerator && gamingCat) {
        await guild.channels.create({
          name: '➕・Click to Create VC',
          type: ChannelType.GuildVoice,
          parent: gamingCat.id,
          userLimit: 1,
          reason: 'Auto-Voice generator channel'
        });
        console.log(`[AUTO_VOICE] Master generator channel created in ${gamingCat.name}`);
      }

      // Cleanup any empty squad rooms left from prior restart
      const orphanSquads = guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildVoice &&
        c.name.startsWith('🎮・') &&
        c.name.endsWith('Squad') &&
        c.members.size === 0
      );
      for (const [, orphan] of orphanSquads) {
        await orphan.delete('Cleanup empty squad voice channel on startup').catch(() => {});
        console.log(`[AUTO_VOICE] Cleaned up orphaned squad channel: ${orphan.name}`);
      }
    } catch (voiceErr) {
      console.warn('[AUTO_VOICE] Startup setup warning:', voiceErr.message);
    }

    console.log(`[STARTUP] Bot startup complete. Ready to receive events.`);
  } catch (err) {
    console.error(`[Verification & Games] Initialization error:`, err.message);
  }
});

async function pollLiveGameDeals(guild) {
  try {
    const updateCh = guild.channels.cache.get('1566922320130351275') || guild.channels.cache.find(c => c.name.includes('update') || c.name.includes('news'));
    if (!updateCh || !updateCh.isTextBased()) return;

    // Fetch recent messages to prevent duplicate postings even across restarts or fresh DBs
    const recentMessages = await updateCh.messages.fetch({ limit: 25 }).catch(() => null);

    // 1. Epic Games Free Promotions
    try {
      const epicRes = await fetch('https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US');
      const epicData = await epicRes.json();
      const elements = epicData.data?.Catalog?.searchStore?.elements || [];
      const freeNow = elements.find(g => {
        const promo = g.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0];
        return promo && promo.discountSetting?.discountPercentage === 0;
      });

      if (freeNow) {
        const inDb = db.hasAutomationFeed('free_games', freeNow.id);
        const inChannel = recentMessages && recentMessages.some(m =>
          m.embeds.some(e => e.title && e.title.toLowerCase().includes(freeNow.title.toLowerCase()))
        );

        if (!inDb && !inChannel) {
          const promo = freeNow.promotions.promotionalOffers[0].promotionalOffers[0];
          const expiry = new Date(promo.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const imgObj = freeNow.keyImages?.find(i => i.type === 'OfferImageWide' || i.type === 'DieselStoreFrontWide') || freeNow.keyImages?.[0];
          const pageSlug = freeNow.productSlug || freeNow.urlSlug || freeNow.offerMappings?.[0]?.pageSlug || '';
          const storeUrl = `https://store.epicgames.com/en-US/p/${pageSlug}`;

          const embed = new EmbedBuilder()
            .setColor(0x10B981)
            .setAuthor({ name: 'GAMER GEAR // FREE GAME ALERT' })
            .setTitle(`🎁 100% FREE TO KEEP: ${freeNow.title.toUpperCase()}`)
            .setDescription([
              `> *"${freeNow.description || 'Grab this game for free on the Epic Games Store!'}"*`,
              '',
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
              '• **Platform:** `Epic Games Store`',
              `• **Offer Validity:** Claim before \`${expiry}\``,
              '• **Cost:** **`FREE (100% OFF)`**',
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            ].join('\n'))
            .setFooter({ text: 'GAMING SHAMING • Instant Freebie Alerts' })
            .setTimestamp();

          if (imgObj) embed.setImage(imgObj.url);

          const claimBtn = new ButtonBuilder()
            .setLabel('🎮 Claim Free on Epic Games Store')
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl);

          const row = new ActionRowBuilder().addComponents(claimBtn);
          const sent = await updateCh.send({ embeds: [embed], components: [row] });
          db.recordAutomationFeed('free_games', freeNow.id, freeNow.title, freeNow, updateCh.id, sent.id);
          console.log(`[DEALS_POLL] Published new Epic free game: ${freeNow.title}`);
        } else if (!inDb) {
          db.recordAutomationFeed('free_games', freeNow.id, freeNow.title, freeNow, updateCh.id, 'channel_duplicate');
        }
      }
    } catch (e) {
      console.warn('[DEALS_POLL] Error fetching Epic free games:', e.message);
    }

    // 2. Steam Top Special Deal
    try {
      const steamRes = await fetch('https://store.steampowered.com/api/featuredcategories/?l=english');
      const steamData = await steamRes.json();
      const topSpecial = (steamData.specials?.items || [])[0];

      if (topSpecial) {
        const inDb = db.hasAutomationFeed('steam_deals', `app_${topSpecial.id}`);
        const inChannel = recentMessages && recentMessages.some(m =>
          m.embeds.some(e => e.title && e.title.toLowerCase().includes(topSpecial.name.toLowerCase()))
        );

        if (!inDb && !inChannel) {
          const salePrice = (topSpecial.final_price / 100).toFixed(2);
          const origPrice = (topSpecial.original_price / 100).toFixed(2);
          const storeUrl = `https://store.steampowered.com/app/${topSpecial.id}/`;

          const embed = new EmbedBuilder()
            .setColor(0x00F0FF)
            .setAuthor({ name: 'GAMER GEAR // STEAM INTELLIGENCE FEED' })
            .setTitle(`🔥 STEAM DEAL: ${topSpecial.name.toUpperCase()} (-${topSpecial.discount_percent}%)`)
            .setDescription([
              'Special promotion detected on the Steam Store:\n',
              `• **Discount:** \`-${topSpecial.discount_percent}% OFF\``,
              `• **Original Price:** ~~\`${origPrice} ${topSpecial.currency}\`~~`,
              `• **Sale Price:** **\`${salePrice} ${topSpecial.currency}\`**`,
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            ].join('\n'))
            .setImage(topSpecial.header_image)
            .setFooter({ text: 'GAMING SHAMING • Steam Bargain Hunter' })
            .setTimestamp();

          const storeBtn = new ButtonBuilder()
            .setLabel('🛒 View Deal on Steam Store')
            .setStyle(ButtonStyle.Link)
            .setURL(storeUrl);

          const steamDbBtn = new ButtonBuilder()
            .setLabel('📊 SteamDB Price History')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://steamdb.info/app/${topSpecial.id}/`);

          const row = new ActionRowBuilder().addComponents(storeBtn, steamDbBtn);
          const sent = await updateCh.send({ embeds: [embed], components: [row] });
          db.recordAutomationFeed('steam_deals', `app_${topSpecial.id}`, topSpecial.name, topSpecial, updateCh.id, sent.id);
          console.log(`[DEALS_POLL] Published new Steam deal: ${topSpecial.name}`);
        } else if (!inDb) {
          db.recordAutomationFeed('steam_deals', `app_${topSpecial.id}`, topSpecial.name, topSpecial, updateCh.id, 'channel_duplicate');
        }
      }
    } catch (e) {
      console.warn('[DEALS_POLL] Error fetching Steam specials:', e.message);
    }
  } catch (err) {
    console.error('[DEALS_POLL_ERROR]', err);
  }
}

async function updateServerStats(guild) {
  try {
    const members = await guild.members.fetch();
    const total = members.size;
    const humans = members.filter(m => !m.user.bot).size;
    const bots = members.filter(m => m.user.bot).size;

    const chAll = guild.channels.cache.get('924523891769081886');
    const chHumans = guild.channels.cache.get('924523894940000321');
    const chBots = guild.channels.cache.get('924523898366734347');

    if (chAll && chAll.name !== `All Members: ${total}`) {
      await chAll.setName(`All Members: ${total}`).catch(() => {});
    }
    if (chHumans && chHumans.name !== `Members: ${humans}`) {
      await chHumans.setName(`Members: ${humans}`).catch(() => {});
    }
    if (chBots && chBots.name !== `Bots: ${bots}`) {
      await chBots.setName(`Bots: ${bots}`).catch(() => {});
    }
    console.log(`[SERVER_STATS] Synchronized stats: All=${total}, Humans=${humans}, Bots=${bots}`);
  } catch (err) {
    console.warn('[SERVER_STATS_WARN]', err.message);
  }
}

async function checkDailyMemeDrop(guild) {
  try {
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentHour = istNow.getHours();
    const dateKey = `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-${String(istNow.getDate()).padStart(2, '0')}`;

    // If it's 6:00 PM (18:00) or later today and we haven't dropped today's meme yet
    if (currentHour >= 18 && !db.hasAutomationFeed('daily_meme', dateKey)) {
      await dropDailyMeme(guild, dateKey);
    }
  } catch (err) {
    console.warn('[DAILY_MEME_CHECK_ERROR]', err.message);
  }
}

async function dropDailyMeme(guild, dateKey) {
  try {
    const memeCh = guild.channels.cache.get('924526497606299719') || guild.channels.cache.find(c => c.name.includes('emes'));
    if (!memeCh || !memeCh.isTextBased()) return;

    // Check recent channel messages for duplicate
    const recent = await memeCh.messages.fetch({ limit: 20 }).catch(() => null);
    const alreadyPostedToday = recent && recent.some(m =>
      m.embeds.some(e => e.footer?.text && e.footer.text.includes(dateKey))
    );

    if (alreadyPostedToday) {
      db.recordAutomationFeed('daily_meme', dateKey, 'Daily Meme', {}, memeCh.id, 'channel_existing');
      return;
    }

    const subreddits = ['gaming', 'memes', 'dankmemes'];
    let meme = null;
    for (const sub of subreddits) {
      try {
        const res = await fetch(`https://meme-api.com/gimme/${sub}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.nsfw && data.url && data.url.match(/\.(jpg|jpeg|png|gif)$/i)) {
          meme = data;
          break;
        }
      } catch (_) {}
    }

    if (!meme) return;

    const embed = new EmbedBuilder()
      .setColor(0x00F0FF)
      .setAuthor({ name: 'GAMING SHAMING // DAILY COMMUNITY MEME DROP', iconURL: guild.iconURL() || undefined })
      .setTitle(`😂 ${meme.title}`)
      .setImage(meme.url)
      .setFooter({ text: `GAMING SHAMING • Daily 6:00 PM Drop [${dateKey}] • r/${meme.subreddit} (👍 ${meme.ups.toLocaleString()} upvotes)` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View on Reddit')
        .setStyle(ButtonStyle.Link)
        .setURL(meme.postLink)
        .setEmoji('🔗')
    );

    const sent = await memeCh.send({ embeds: [embed], components: [row] });
    db.recordAutomationFeed('daily_meme', dateKey, meme.title, meme, memeCh.id, sent.id);
    console.log(`[DAILY_MEME] Published daily meme drop for ${dateKey}: "${meme.title}"`);
  } catch (err) {
    console.error('[DAILY_MEME_ERROR]', err);
  }
}

async function pollRedditLfgFeed(guild) {
  try {
    const redditLfgCh = guild.channels.cache.get('1567629497119936607') || guild.channels.cache.find(c => c.name.includes('eddit-'));
    if (!redditLfgCh || !redditLfgCh.isTextBased()) return;

    const res = await fetch('https://www.reddit.com/r/GamerPals/new.rss', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) return;
    const xml = await res.text();
    const matches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

    // Fetch recent messages to prevent duplicates
    const recentMessages = await redditLfgCh.messages.fetch({ limit: 25 }).catch(() => null);

    // Process newest unposted LFG post
    for (const m of matches.slice(0, 5)) {
      const id = (m.match(/<id>([\s\S]*?)<\/id>/)?.[1] || '').trim();
      const title = (m.match(/<title>([\s\S]*?)<\/title>/)?.[1] || 'Looking for Squad').replace(/&amp;/g, '&');
      const link = m.match(/<link href="([^"]+)"/)?.[1] || 'https://reddit.com';
      const author = (m.match(/<author><name>([\s\S]*?)<\/name>/)?.[1] || 'u/RedditGamer').replace('/u/', '');

      if (!id || !title) continue;

      const inDb = db.hasAutomationFeed('reddit_lfg', id);
      const inChannel = recentMessages && recentMessages.some(msg =>
        msg.embeds.some(e => e.title && e.title.includes(title))
      );

      if (!inDb && !inChannel) {
        const contentRaw = m.match(/<content type="html">([\s\S]*?)<\/content>/)?.[1] || '';
        const textClean = contentRaw
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300);

        const embed = new EmbedBuilder()
          .setColor(0xFF4500) // Reddit Orange
          .setAuthor({ name: `r/GamerPals • Posted by u/${author}`, iconURL: 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png' })
          .setTitle(`📢 ${title}`)
          .setDescription([
            `> *"${textClean || 'Check the Reddit post for full details and games list!'}"*`,
            '',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            `• **Platform/Hub:** \`r/GamerPals\``,
            `• **Author:** [\`u/${author}\`](https://reddit.com/user/${author})`,
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          ].join('\n'))
          .setFooter({ text: 'GAMING SHAMING • Live Reddit Matchmaking Feed' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('🎮 View Post & Message Player')
            .setStyle(ButtonStyle.Link)
            .setURL(link)
            .setEmoji('💬'),
          new ButtonBuilder()
            .setLabel('Create Squad Here (/lfg)')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.com/channels/924325170972340264/1567553522403385425')
            .setEmoji('🚀')
        );

        const sent = await redditLfgCh.send({ embeds: [embed], components: [row] });
        db.recordAutomationFeed('reddit_lfg', id, title, { author, link }, redditLfgCh.id, sent.id);
        console.log(`[REDDIT_LFG] Published new Reddit squad post: "${title}" (${id})`);
        break; // Post one new post per poll interval to prevent spam
      } else if (!inDb) {
        db.recordAutomationFeed('reddit_lfg', id, title, { author, link }, redditLfgCh.id, 'channel_duplicate');
      }
    }
  } catch (err) {
    console.warn('[REDDIT_LFG_POLL_WARN]', err.message);
  }
}

async function pollPCHardwareDeals(guild) {
  try {
    const pcDealsCh = guild.channels.cache.get('1567632410135371887') || guild.channels.cache.find(c => c.name.includes('ear-'));
    if (!pcDealsCh || !pcDealsCh.isTextBased()) return;

    // Fetch recent messages to prevent duplicates
    const recentMessages = await pcDealsCh.messages.fetch({ limit: 25 }).catch(() => null);

    const dealSources = ['desidime', 'laptop_loot_deals', 'DealBee'];

    for (const source of dealSources) {
      try {
        const res = await fetch(`https://t.me/s/${source}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
          }
        });
        if (!res.ok) continue;

        const html = await res.text();
        const rawMsgs = html.match(/<div class="tgme_widget_message_wrap[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];

        for (const m of rawMsgs.slice(-10)) {
          const idMatch = m.match(/data-post="([^"]+)"/);
          const id = idMatch ? idMatch[1] : '';
          const textMatch = m.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
          if (!id || !textMatch) continue;

          const rawHtml = textMatch[1];
          const lines = rawHtml.split(/<br\s*\/?>/gi).map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
          const fullText = lines.join(' ');

          // Skip non-deal or meta posts
          if (/Top 5|Threads Today|Daily Rewards|Channel photo|Channel created/i.test(fullText)) continue;
          if (/kurta|dress|saree|shampoo|dinner set|facial tissue|sauce pan|suitcase|trolley|refrigerator|shoes|sneakers|deodorant|jeans|shirt|pants|underwear|bra|towel|blanket/i.test(fullText)) continue;

          // 1. Discount filter: Strict >= 60% OFF
          const pctMatch = fullText.match(/(\d+)%\s*(?:off|discount)/i) || fullText.match(/(?:off|discount)[:\s]*(\d+)%/i);
          const pct = pctMatch ? parseInt(pctMatch[1], 10) : null;
          if (!pct || pct < 60) continue;

          // 2. Tech / Gaming hardware filter
          const techRegex = /\b(pc|gaming|laptop|keyboard|mouse|headset|headphone|earbuds|monitor|gpu|cpu|ram|ssd|nvme|motherboard|controller|oled|ips|qled|soundbar|speaker|tv|logitech|razer|zebronics|aoc|corsair|lenovo|asus|acer|msi|hp|dell|ryzen|intel|rtx)\b/i;
          if (!techRegex.test(fullText)) continue;

          // 3. Price in INR (₹ or Rs)
          const priceMatch = fullText.match(/[₹Rs\.]+\s*([\d,]+)/i);
          const price = priceMatch ? priceMatch[1] : 'Special Price';

          // 4. Extract link
          const linkMatches = m.match(/href="([^"]+)"/g) || [];
          const links = linkMatches.map(l => l.replace(/href="|"/g, '')).filter(l => !l.includes('t.me') && !l.includes('telegram.org'));
          let buyLink = links.find(l => l.includes('buy') || l.includes('amzn') || l.includes('amazon') || l.includes('fkrt') || l.includes('flipkart') || l.includes('ddime.in')) || links[0];
          if (!buyLink) continue;

          // Store detection: Amazon India vs Flipkart vs India Retailer
          let store = 'India Deal';
          let storeColor = 0x10B981; // Emerald
          let storeEmoji = '🛒';
          let storeIcon = 'https://cdn-icons-png.flaticon.com/512/879/879757.png';

          if (/amazon|amzn/i.test(fullText) || /amazon|amzn/i.test(buyLink)) {
            store = 'Amazon India';
            storeColor = 0xFF9900; // Amazon Orange
            storeEmoji = '📦';
            storeIcon = 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Amazon_icon.svg';
          } else if (/flipkart|fkrt/i.test(fullText) || /flipkart|fkrt/i.test(buyLink)) {
            store = 'Flipkart';
            storeColor = 0x2874F0; // Flipkart Blue
            storeEmoji = '⚡';
            storeIcon = 'https://cdn.iconscout.com/icon/free/png-512/free-flipkart-226594.png';
          }

          const inDb = db.hasAutomationFeed('india_deal', id);
          const cleanTitle = lines[0].replace(/^[^\p{L}\p{N}\s]+/gu, '').trim().slice(0, 200);

          const inChannel = recentMessages && recentMessages.some(msg =>
            msg.embeds.some(e => e.title && e.title.includes(cleanTitle.slice(0, 40)))
          );

          if (!inDb && !inChannel) {
            const summaryPoints = lines.slice(1, 4).filter(l => !l.startsWith('http') && !l.includes('Read More')).map(l => `• ${l}`).join('\n') || '• Verified Indian marketplace gaming hardware discount.';

            const embed = new EmbedBuilder()
              .setColor(storeColor)
              .setAuthor({ name: `GAMER GEAR // INDIA GAMING RADAR • [${store.toUpperCase()}]`, iconURL: storeIcon })
              .setTitle(`🔥 [${store} • ${pct}% OFF] ${cleanTitle}`)
              .setDescription([
                `Verified **60%+ discount** on gaming gear & PC components:`,
                '',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                `• 💰 **Deal Price:** \`₹${price}\``,
                `• 🏷️ **Discount:** **${pct}% OFF** (Loot Sale)`,
                `• 🏪 **Marketplace:** **${store}**`,
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                '',
                '### 📦 Specifications & Highlights:',
                summaryPoints,
                '',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
              ].join('\n'))
              .setFooter({ text: 'GAMING SHAMING • India PC Gear Radar (Min 60% OFF)' })
              .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel(`🛒 Buy on ${store}`)
                .setStyle(ButtonStyle.Link)
                .setURL(buyLink)
                .setEmoji('🇮🇳')
            );

            const dealContent = pct >= 70 ? `<@&${IDS.DEAL_HUNTER_ROLE_ID}> 🔥 **MEGA HARDWARE LOOT ALERT (${pct}% OFF)!**` : undefined;
            const sent = await pcDealsCh.send({ content: dealContent, embeds: [embed], components: [row] });
            db.recordAutomationFeed('india_deal', id, cleanTitle, { store, pct, price, buyLink }, pcDealsCh.id, sent.id);
            console.log(`[INDIA_PC_DEALS] Published deal: [${store} • ${pct}% OFF] "${cleanTitle}" (${id})`);
            return; // 1 deal per hourly cycle to prevent spam
          } else if (!inDb) {
            db.recordAutomationFeed('india_deal', id, cleanTitle, {}, pcDealsCh.id, 'channel_duplicate');
          }
        }
      } catch (srcErr) {
        console.warn(`[INDIA_PC_DEALS_SRC_WARN] ${source}:`, srcErr.message);
      }
    }
  } catch (err) {
    console.warn('[INDIA_PC_DEALS_POLL_WARN]', err.message);
  }
}

client.login(token);
