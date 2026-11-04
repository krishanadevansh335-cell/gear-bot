import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle
} from 'discord.js';
import { GameDatabase } from '../../dist/game-db.js';
import { DynamicGameManager } from '../../dist/game-manager.js';
import {
  buildGameCommands,
  handleGameCommands,
  handleMemberIdentityCommands,
  handleMemberIdentityComponents
} from '../../dist/game-commands.js';
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
    GatewayIntentBits.MessageContent
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
  new SlashCommandBuilder().setName('review-pending').setDescription('List members awaiting moderator review.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
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
    const ch = guild.channels.cache.find(c => c.name === names.verify);
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
 * Public onboarding greeting in #verify with the Start Verification button
 */
async function begin(member) {
  const guild = member.guild;
  const { created, session } = db.getOrCreateVerificationSession(guild.id, member.id);
  if (!created && (session.status === 'completed' || session.status === 'review')) {
    return;
  }
  scheduleTimers(guild, member.id);

  const verifyCh = guild.channels.cache.find(c => c.name === names.verify);
  const rulesCh = guild.channels.cache.find(c => c.name === names.rules);

  if (verifyCh && verifyCh.isTextBased()) {
    const welcome = buildPublicVerifyWelcome(rulesCh ? rulesCh.id : undefined);
    await verifyCh.send({
      content: `👋 Welcome <@${member.id}>! You've completed the initial onboarding questions. Now, please click **Start Verification** below to complete your Game Gear verification and unlock full access to the server!`,
      components: welcome.components,
      allowedMentions: { parse: [], users: [member.id] }
    }).catch(() => {});
  }
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
  if (member.guild.id !== guildId || member.user.bot) return;
  const isPending = Boolean(member.pending);
  console.log(`[SCREENING_EVENT_RECEIVED] guildMemberAdd — user=${member.user.tag} id=${member.id} pending=${isPending}`);
  db.recordScreeningEvent(member.id, guildId, 'guildMemberAdd', null, isPending);

  if (isPending) {
    console.log(`[SCREENING_EVENT_RECEIVED] Member ${member.user.tag} joined with rules screening pending.`);
    return;
  }

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
  }

  // Detect completion of Discord's 3 Native Onboarding Questions:
  // Transition from not having onboarding roles to having them
  const hadOnboarding = hasCompletedNativeOnboarding(oldMember);
  const hasOnboarding = hasCompletedNativeOnboarding(newMember);

  if (!hadOnboarding && hasOnboarding) {
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
      const lfgCh = interaction.guild.channels.cache.find(c => c.name === 'looking-for-group');
      const roleMention = g?.role_id ? `<@&${g.role_id}>` : `@${g?.role_name || slug}`;
      await safeEditOrReply(interaction, {
        content: `🎮 Looking for **${g?.name || slug}** teammates? Head over to <#${lfgCh?.id || '1566922336404246568'}> and ping ${roleMention} to squad up!`,
        components: []
      });
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
        if (!session.step || session.step === 'games' || session.step === 'agree') {
          session.step = 'detected';
          db.updateVerificationSession(guildId, userId, { step: 'detected', answers: session.answers });
        }
      }

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

    // Step 2: Gender
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
      db.updateVerificationSession(guildId, userId, { step: 'timing', answers: s.answers });
      await safeEditOrReply(interaction, buildStepTimingPayload(s.answers.timing, s.answers.timezone));
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
  }
});

// Guard against public chat data leakage in #verify
client.on('messageCreate', async msg => {
  if (!msg.guild || msg.guild.id !== guildId || msg.author.bot) return;
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

client.once('clientReady', async () => {
  console.log(`[Verification & Games] Logged in as ${client.user.tag}`);
  console.log(`[STARTUP] Bot connected to Discord. Guild ID target: ${guildId}`);
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

    console.log(`[STARTUP] Bot startup complete. Ready to receive events.`);
  } catch (err) {
    console.error(`[Verification & Games] Initialization error:`, err.message);
  }
});

client.login(token);
