import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import {
  buildConfirmationSummary,
  formatConfirmationCard
} from "./verification-parser.js";

/**
 * Builds the initial public Welcome / Start Verification message in #verify
 */
export function buildPublicVerifyWelcome(rulesChannelId?: string) {
  const content = [
    `🛡️ **Welcome to Gamer Gear Server Verification**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    rulesChannelId ? `1️⃣ Read our community guidelines in <#${rulesChannelId}>.` : `1️⃣ Read our community guidelines in #rules.`,
    `2️⃣ Click **Start Verification** below to configure your gaming profile and access the server.`,
    `\n🔒 **Privacy Protection:**`,
    `Your age, optional gender, and personal answers are collected via **private (ephemeral)** interactions and will **never** be posted publicly in this channel.`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  ].join("\n");

  const startButton = new ButtonBuilder()
    .setCustomId("verify_start_btn")
    .setLabel("🛡️ Start Verification")
    .setStyle(ButtonStyle.Primary);

  const statusButton = new ButtonBuilder()
    .setCustomId("verify_check_status_btn")
    .setLabel("Check Status")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(startButton, statusButton);

  return { content, components: [row] };
}

/**
 * Builds Step 1: Age Classification
 */
export function buildStepAgePayload() {
  const content = [
    `**Step 1 of 6: Age Group Classification**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Discord terms and server safety require age-based channel separation:`,
    `• **18+ Member**: Access to adult gaming & general discussion channels.`,
    `• **Teen Member (13–17)**: Access to dedicated youth discussion & matchmaking channels.`,
    `\n*Please select your age group below. This information is private to you and moderators.*`
  ].join("\n");

  const adultBtn = new ButtonBuilder()
    .setCustomId("verify_age_adult")
    .setLabel("🔞 18+ Member")
    .setStyle(ButtonStyle.Success);

  const minorBtn = new ButtonBuilder()
    .setCustomId("verify_age_minor")
    .setLabel("🎮 Teen Member (13–17)")
    .setStyle(ButtonStyle.Primary);

  const customAgeBtn = new ButtonBuilder()
    .setCustomId("verify_age_custom_modal")
    .setLabel("✏️ Enter Exact Age")
    .setStyle(ButtonStyle.Secondary);

  const cancelBtn = new ButtonBuilder()
    .setCustomId("verify_cancel_btn")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(adultBtn, minorBtn, customAgeBtn, cancelBtn);

  return { content, components: [row] };
}

/**
 * Builds Modal for entering exact age
 */
export function buildAgeInputModal() {
  const modal = new ModalBuilder()
    .setCustomId("modal_age_submit")
    .setTitle("Age Verification");

  const ageInput = new TextInputBuilder()
    .setCustomId("age_number_input")
    .setLabel("Enter your age (number only):")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. 21")
    .setMinLength(1)
    .setMaxLength(3)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(ageInput);
  modal.addComponents(row);
  return modal;
}

/**
 * Builds Step 2: Gender (Optional)
 */
export function buildStepGenderPayload() {
  const content = [
    `**Step 2 of 6: Gender (Optional)**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Choose a gender role for your profile if you wish, or click **Skip** to keep it completely private:`,
    `• Gender is never posted publicly or shared with other members.`
  ].join("\n");

  const maleBtn = new ButtonBuilder()
    .setCustomId("verify_gender_male")
    .setLabel("Male")
    .setStyle(ButtonStyle.Secondary);

  const femaleBtn = new ButtonBuilder()
    .setCustomId("verify_gender_female")
    .setLabel("Female")
    .setStyle(ButtonStyle.Secondary);

  const nbBtn = new ButtonBuilder()
    .setCustomId("verify_gender_nb")
    .setLabel("Non-binary")
    .setStyle(ButtonStyle.Secondary);

  const pntsBtn = new ButtonBuilder()
    .setCustomId("verify_gender_pnts")
    .setLabel("Prefer not to say")
    .setStyle(ButtonStyle.Secondary);

  const skipBtn = new ButtonBuilder()
    .setCustomId("verify_gender_skip")
    .setLabel("Skip ➔")
    .setStyle(ButtonStyle.Primary);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(maleBtn, femaleBtn, nbBtn, pntsBtn);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("verify_nav_back_to_age").setLabel("⬅️ Back").setStyle(ButtonStyle.Secondary),
    skipBtn
  );

  return { content, components: [row1, row2] };
}

/**
 * Builds Step 3: Games selection
 */
export function buildStepGamesPayload(existingGames: any[] = [], gamesCatalog: any[] = []) {
  const gamesSummary = existingGames.length > 0
    ? existingGames.map(g => `• **${g.game}** (${g.platform || 'Platform missing'} · ${g.skill || 'Skill missing'})`).join("\n")
    : "*No games selected yet.*";

  const content = [
    `**Step 3 of 6: Select Your Games**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `**Currently Selected:**\n${gamesSummary}`,
    `\nPick games from the menu below, or click **Add Custom Game** to type any title.`
  ].join("\n");

  const components: any[] = [];

  // Dropdown for top games if catalog provided
  if (gamesCatalog.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("verify_games_dropdown")
      .setPlaceholder("Choose from popular community games")
      .setMinValues(1)
      .setMaxValues(Math.min(gamesCatalog.length, 5));

    gamesCatalog.slice(0, 25).forEach(g => {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(g.name.slice(0, 100))
          .setValue(g.slug)
          .setDescription(`Select ${g.name}`.slice(0, 100))
      );
    });

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  const addCustomBtn = new ButtonBuilder()
    .setCustomId("verify_games_modal_btn")
    .setLabel("📝 Add Custom Game / Text")
    .setStyle(ButtonStyle.Secondary);

  const nextBtn = new ButtonBuilder()
    .setCustomId("verify_nav_to_timing")
    .setLabel(existingGames.length > 0 ? "Next: Schedule ➔" : "Next (Skip Games) ➔")
    .setStyle(ButtonStyle.Primary);

  const backBtn = new ButtonBuilder()
    .setCustomId("verify_nav_back_to_gender")
    .setLabel("⬅️ Back")
    .setStyle(ButtonStyle.Secondary);

  const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn, addCustomBtn, nextBtn);
  components.push(rowButtons);

  return { content, components };
}

/**
 * Builds Step for configuring missing platform & skill for a selected game
 */
export function buildMissingPlatformSkillPayload(gameName: string) {
  const content = [
    `**Configuring: ${gameName}**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Please choose your **Platform** for **${gameName}**:`,
    `*(We do not silently assume a platform to avoid assigning incorrect squad roles.)*`
  ].join("\n");

  const pcBtn = new ButtonBuilder().setCustomId(`game_plat_pc_${gameName}`).setLabel("PC").setStyle(ButtonStyle.Secondary);
  const psBtn = new ButtonBuilder().setCustomId(`game_plat_ps_${gameName}`).setLabel("PlayStation").setStyle(ButtonStyle.Secondary);
  const xboxBtn = new ButtonBuilder().setCustomId(`game_plat_xbox_${gameName}`).setLabel("Xbox").setStyle(ButtonStyle.Secondary);
  const mobileBtn = new ButtonBuilder().setCustomId(`game_plat_mobile_${gameName}`).setLabel("Mobile").setStyle(ButtonStyle.Secondary);
  const switchBtn = new ButtonBuilder().setCustomId(`game_plat_switch_${gameName}`).setLabel("Switch").setStyle(ButtonStyle.Secondary);

  const rowPlat = new ActionRowBuilder<ButtonBuilder>().addComponents(pcBtn, psBtn, xboxBtn, mobileBtn, switchBtn);

  return { content, components: [rowPlat] };
}

export function buildMissingSkillPayload(gameName: string, platform: string) {
  const content = [
    `**Configuring: ${gameName} (${platform})**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Please choose your **Skill Level**:`,
    `• **Beginner**: Just starting out or casual gameplay.`,
    `• **Intermediate**: Comfortable with game mechanics and teamwork.`,
    `• **Competitive / Pro**: High rank or competitive play.`
  ].join("\n");

  const begBtn = new ButtonBuilder().setCustomId(`game_skill_beg_${gameName}`).setLabel("Beginner").setStyle(ButtonStyle.Secondary);
  const interBtn = new ButtonBuilder().setCustomId(`game_skill_inter_${gameName}`).setLabel("Intermediate").setStyle(ButtonStyle.Secondary);
  const compBtn = new ButtonBuilder().setCustomId(`game_skill_comp_${gameName}`).setLabel("Competitive / Pro").setStyle(ButtonStyle.Secondary);

  const rowSkill = new ActionRowBuilder<ButtonBuilder>().addComponents(begBtn, interBtn, compBtn);

  return { content, components: [rowSkill] };
}

/**
 * Builds Step 4: Schedule and Timezone
 */
export function buildStepTimingPayload(currentTiming?: string, currentTimezone?: string) {
  const summary = [
    `**Step 4 of 6: Play Schedule & Timezone**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    currentTiming ? `**Schedule:** ${currentTiming}` : `**Schedule:** *Not selected yet*`,
    currentTimezone ? `**Timezone:** ${currentTimezone}` : `**Timezone:** *Not selected yet*`,
    `\nWhen do you usually play? Choose a quick option or click **Type Schedule**:`
  ].join("\n");

  const allDayBtn = new ButtonBuilder().setCustomId("verify_timing_allday").setLabel("☀️ All Day / Anytime").setStyle(ButtonStyle.Secondary);
  const eveningBtn = new ButtonBuilder().setCustomId("verify_timing_evenings").setLabel("🌇 Evenings").setStyle(ButtonStyle.Secondary);
  const weekendBtn = new ButtonBuilder().setCustomId("verify_timing_weekends").setLabel("🎉 Weekends").setStyle(ButtonStyle.Secondary);
  const nightBtn = new ButtonBuilder().setCustomId("verify_timing_nights").setLabel("🌙 Late Night").setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(allDayBtn, eveningBtn, weekendBtn, nightBtn);

  // Timezone row
  const istBtn = new ButtonBuilder().setCustomId("verify_tz_ist").setLabel("IST (UTC+5:30)").setStyle(ButtonStyle.Secondary);
  const estBtn = new ButtonBuilder().setCustomId("verify_tz_est").setLabel("EST (UTC-5)").setStyle(ButtonStyle.Secondary);
  const pstBtn = new ButtonBuilder().setCustomId("verify_tz_pst").setLabel("PST (UTC-8)").setStyle(ButtonStyle.Secondary);
  const utcBtn = new ButtonBuilder().setCustomId("verify_tz_utc").setLabel("UTC / GMT").setStyle(ButtonStyle.Secondary);

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(istBtn, estBtn, pstBtn, utcBtn);

  const backBtn = new ButtonBuilder().setCustomId("verify_nav_back_to_games").setLabel("⬅️ Back").setStyle(ButtonStyle.Secondary);
  const customBtn = new ButtonBuilder().setCustomId("verify_timing_modal_btn").setLabel("✏️ Type Schedule / TZ").setStyle(ButtonStyle.Secondary);
  const nextBtn = new ButtonBuilder().setCustomId("verify_nav_to_looking").setLabel("Next: Goals ➔").setStyle(ButtonStyle.Primary);

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn, customBtn, nextBtn);

  return { content: summary, components: [row1, row2, row3] };
}

/**
 * Builds Step 5: What are you looking for?
 */
export function buildStepLookingPayload(selected: string[] = []) {
  const isSelected = (item: string) => selected.includes(item);

  const content = [
    `**Step 5 of 6: What are you looking for?**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Selected: **${selected.length > 0 ? selected.join(", ") : "None yet"}**`,
    `\nToggle preferences or choose **All of them**:`
  ].join("\n");

  const allBtn = new ButtonBuilder()
    .setCustomId("verify_look_all")
    .setLabel("🌟 All of them")
    .setStyle(selected.length === 4 ? ButtonStyle.Success : ButtonStyle.Primary);

  const casualBtn = new ButtonBuilder()
    .setCustomId("verify_look_casual")
    .setLabel("🎮 Casual friends")
    .setStyle(isSelected("Casual friends") ? ButtonStyle.Success : ButtonStyle.Secondary);

  const rankedBtn = new ButtonBuilder()
    .setCustomId("verify_look_ranked")
    .setLabel("🏆 Ranked squad")
    .setStyle(isSelected("Ranked squad") ? ButtonStyle.Success : ButtonStyle.Secondary);

  const chillBtn = new ButtonBuilder()
    .setCustomId("verify_look_chill")
    .setLabel("🎧 Chill VC")
    .setStyle(isSelected("Chill VC") ? ButtonStyle.Success : ButtonStyle.Secondary);

  const coopBtn = new ButtonBuilder()
    .setCustomId("verify_look_coop")
    .setLabel("🤝 Co-op")
    .setStyle(isSelected("Co-op") ? ButtonStyle.Success : ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(allBtn, casualBtn, rankedBtn);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(chillBtn, coopBtn);

  const backBtn = new ButtonBuilder().setCustomId("verify_nav_back_to_timing").setLabel("⬅️ Back").setStyle(ButtonStyle.Secondary);
  const nextBtn = new ButtonBuilder()
    .setCustomId("verify_nav_to_language")
    .setLabel("Next: Language ➔")
    .setStyle(ButtonStyle.Primary);

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn, nextBtn);

  return { content, components: [row1, row2, row3] };
}

/**
 * Builds Step 6: Voice Language (Optional)
 */
export function buildStepLanguagePayload(currentLang?: string | null) {
  const content = [
    `**Step 6 of 6: Preferred Voice Chat Language (Optional)**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    currentLang ? `Selected: **${currentLang}**` : `Selected: *None (Skipped)*`,
    `\nChoose your primary voice chat language, or click **Skip**:`
  ].join("\n");

  const enBtn = new ButtonBuilder().setCustomId("verify_lang_en").setLabel("English").setStyle(ButtonStyle.Secondary);
  const hiBtn = new ButtonBuilder().setCustomId("verify_lang_hi").setLabel("Hindi").setStyle(ButtonStyle.Secondary);
  const esBtn = new ButtonBuilder().setCustomId("verify_lang_es").setLabel("Spanish").setStyle(ButtonStyle.Secondary);
  const otherBtn = new ButtonBuilder().setCustomId("verify_lang_modal_btn").setLabel("Other / Type").setStyle(ButtonStyle.Secondary);
  const skipBtn = new ButtonBuilder().setCustomId("verify_lang_skip").setLabel("Skip ➔").setStyle(ButtonStyle.Primary);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(enBtn, hiBtn, esBtn, otherBtn, skipBtn);

  const backBtn = new ButtonBuilder().setCustomId("verify_nav_back_to_looking").setLabel("⬅️ Back").setStyle(ButtonStyle.Secondary);
  const reviewBtn = new ButtonBuilder().setCustomId("verify_nav_to_confirm").setLabel("Review Summary ➔").setStyle(ButtonStyle.Success);

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn, reviewBtn);

  return { content, components: [row1, row2] };
}

/**
 * Builds Final Confirmation Summary Screen
 */
export function buildConfirmationPayload(answers: Record<string, any>) {
  const summaryData = buildConfirmationSummary(answers);
  const content = formatConfirmationCard(summaryData);

  const confirmBtn = new ButtonBuilder()
    .setCustomId("verify_final_confirm_btn")
    .setLabel("✅ Confirm & Get Roles")
    .setStyle(ButtonStyle.Success);

  const editBtn = new ButtonBuilder()
    .setCustomId("verify_final_edit_btn")
    .setLabel("✏️ Edit Answers")
    .setStyle(ButtonStyle.Secondary);

  const cancelBtn = new ButtonBuilder()
    .setCustomId("verify_cancel_btn")
    .setLabel("❌ Cancel")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, editBtn, cancelBtn);

  return { content, components: [row] };
}

/**
 * Builds Detected Onboarding Preferences Payload for members who completed Discord native onboarding
 */
export function buildOnboardingDetectedPayload(answers: {
  games?: Array<{ game: string; platform?: string; skill?: string }>;
  platforms?: string[];
  experiences?: string[];
}) {
  const gamesList = answers.games && answers.games.length > 0
    ? answers.games.map(g => `• **${g.game}**${g.platform ? ` (${g.platform})` : ''}`).join('\n')
    : '• *None selected*';
  const platformsList = answers.platforms && answers.platforms.length > 0
    ? answers.platforms.join(', ')
    : '*None selected*';
  const experiencesList = answers.experiences && answers.experiences.length > 0
    ? answers.experiences.join(', ')
    : '*None selected*';

  const content = [
    `🛡️ **Welcome to Gamer Gear Server Verification**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `We detected your answers from the **3 server onboarding questions**:`,
    ``,
    `🎮 **1. Games Selected:**\n${gamesList}`,
    `💻 **2. Platform(s):** ${platformsList}`,
    `🎯 **3. Preferred Experience:** ${experiencesList}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `To finish verifying your profile and unlock full server access, please proceed to age classification:`,
    `*(Your age and private info are strictly confidential and will never be shared publicly.)*`
  ].join('\n');

  const continueBtn = new ButtonBuilder()
    .setCustomId('onboard_continue_to_age')
    .setLabel('Continue to Age Verification ➔')
    .setStyle(ButtonStyle.Success);

  const editBtn = new ButtonBuilder()
    .setCustomId('onboard_edit_prefs')
    .setLabel('✏️ Edit Preferences')
    .setStyle(ButtonStyle.Secondary);

  const cancelBtn = new ButtonBuilder()
    .setCustomId('verify_cancel_btn')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(continueBtn, editBtn, cancelBtn);

  return { content, components: [row] };
}

/**
 * Builds Question 2 of Onboarding: Platform Selection
 * Reuses the exact 5 platforms configured in Discord native onboarding
 */
export function buildOnboardingPlatformPayload(selectedPlatforms: string[] = []) {
  const platforms = ['PC', 'PlayStation', 'Xbox', 'Mobile', 'Nintendo Switch'];
  const summary = selectedPlatforms.length > 0
    ? selectedPlatforms.join(', ')
    : '*None selected yet*';

  const content = [
    `**Onboarding Question 2 of 3: Which platform do you use?**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Selected: **${summary}**`,
    `\nChoose your primary gaming platform(s):`
  ].join('\n');

  const buttons = platforms.map(plat => {
    const isSelected = selectedPlatforms.includes(plat);
    const code = plat.toLowerCase().replace(/[^a-z0-9]/g, '');
    return new ButtonBuilder()
      .setCustomId(`onboard_plat_${code}`)
      .setLabel(plat)
      .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary);
  });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 3));
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(3, 5));

  const backBtn = new ButtonBuilder()
    .setCustomId('onboard_nav_back_to_games')
    .setLabel('⬅️ Back: Games')
    .setStyle(ButtonStyle.Secondary);

  const nextBtn = new ButtonBuilder()
    .setCustomId('onboard_nav_to_experience')
    .setLabel('Next: Experience ➔')
    .setStyle(ButtonStyle.Primary);

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn, nextBtn);

  return { content, components: [row1, row2, row3] };
}

/**
 * Builds Question 3 of Onboarding: Gaming Experience Selection
 * Reuses the exact 7 experiences configured in Discord native onboarding
 */
export function buildOnboardingExperiencePayload(selectedExperiences: string[] = []) {
  const experiences = [
    'Competitive',
    'Casual',
    'Co-op',
    'Survival',
    'RPG',
    'Horror',
    'Social gaming'
  ];
  const summary = selectedExperiences.length > 0
    ? selectedExperiences.join(', ')
    : '*None selected yet*';

  const content = [
    `**Onboarding Question 3 of 3: What type of gaming experience do you prefer?**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Selected: **${summary}**`,
    `\nChoose the gaming styles and experiences you enjoy:`
  ].join('\n');

  const expCodeMap: Record<string, string> = {
    'Competitive': 'comp',
    'Casual': 'casual',
    'Co-op': 'coop',
    'Survival': 'survival',
    'RPG': 'rpg',
    'Horror': 'horror',
    'Social gaming': 'social'
  };

  const buttons = experiences.map(exp => {
    const isSelected = selectedExperiences.includes(exp);
    const code = expCodeMap[exp] || exp.toLowerCase();
    return new ButtonBuilder()
      .setCustomId(`onboard_exp_${code}`)
      .setLabel(exp)
      .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary);
  });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 4));
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(4, 7));

  const backBtn = new ButtonBuilder()
    .setCustomId('onboard_nav_back_to_platform')
    .setLabel('⬅️ Back: Platform')
    .setStyle(ButtonStyle.Secondary);

  const nextBtn = new ButtonBuilder()
    .setCustomId('onboard_nav_to_age')
    .setLabel('Continue to Verification ➔')
    .setStyle(ButtonStyle.Success);

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn, nextBtn);

  return { content, components: [row1, row2, row3] };
}


