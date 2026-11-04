/**
 * Verification Natural Language Parser & Conversational Engine
 *
 * Implements flexible parsing with normalization, aliases, conversational feedback,
 * and privacy safeguards for Discord server onboarding.
 */

export interface ParsedSchedule {
  raw: string;
  timings: string[]; // ['morning', 'afternoon', 'evening', 'late night', 'weekend']
  displayTiming: string;
  timezone: string | null;
  isAllDay: boolean;
  needsTimezoneFollowup: boolean;
  conversationalResponse: string;
}

export interface ParsedLookingFor {
  raw: string;
  preferences: string[]; // ['Casual friends', 'Ranked squad', 'Chill VC', 'Co-op']
  isAll: boolean;
  conversationalResponse: string;
}

export interface ParsedGender {
  raw: string;
  gender: "Male" | "Female" | "Non-binary" | null;
  isSkipped: boolean;
  isValid: boolean;
  conversationalResponse: string;
}

export interface ParsedGameItem {
  game: string;
  slug: string;
  platform?: string; // 'PC' | 'PlayStation' | 'Xbox' | 'Mobile' | 'Nintendo Switch'
  skill?: string;    // 'Beginner' | 'Intermediate' | 'Competitive'
  missingPlatform: boolean;
  missingSkill: boolean;
}

export interface ParsedGamesResult {
  raw: string;
  games: ParsedGameItem[];
  unlistedGames: string[];
  conversationalResponse: string;
}

export interface ConfirmationSummaryData {
  gamesStr: string;
  platformsStr: string;
  skillLevelsStr: string;
  scheduleStr: string;
  timezoneStr: string;
  lookingForStr: string;
  voiceLanguageStr: string;
  ageClassificationStr: string;
  isMinor: boolean;
}

// ── 1. Schedule & Timezone Parsing ──────────────────────────────────────────

const ALL_DAY_TRIGGERS = [
  "all day", "anytime", "any time", "every day", "everyday", "always",
  "24/7", "whenever", "all", "all of it", "throughout the day", "whole day"
];

const TIME_REGEXES: Array<{ key: string; label: string; regex: RegExp }> = [
  { key: "morning", label: "Morning", regex: /\b(mornings?|am|early|dawn)\b/i },
  { key: "afternoon", label: "Afternoon", regex: /\b(afternoons?|mid-?day|noon|pm)\b/i },
  { key: "evening", label: "Evening", regex: /\b(evenings?|sunset|dusk)\b/i },
  { key: "late night", label: "Late Night", regex: /\b(late\s*nights?|nights?|midnight|graveyard)\b/i },
  { key: "weekend", label: "Weekends", regex: /\b(weekends?|sat|saturday|sun|sunday|mostly\s*weekends?)\b/i }
];

const TIMEZONE_REGEX = /\b(IST(?:\s*\(UTC\+5:30\))?|EST(?:\s*\(UTC-5\))?|PST(?:\s*\(UTC-8\))?|UTC[+-]\d{1,2}(?::\d{2})?|GMT[+-]\d{1,2}|IST|EST|EDT|PST|PDT|CST|CDT|MST|MDT|BST|CET|CEST|JST|AEST|NZST|UTC|GMT)\b/i;

export function extractTimezone(text: string): string | null {
  const match = text.match(TIMEZONE_REGEX);
  if (!match) return null;
  const raw = match[1].trim();
  const tz = raw.toUpperCase();
  if (tz.startsWith("IST")) return "IST (UTC+5:30)";
  if (tz.startsWith("EST")) return "EST (UTC-5)";
  if (tz.startsWith("PST")) return "PST (UTC-8)";
  return tz;
}

export function parseSchedule(input: string): ParsedSchedule {
  const clean = input.trim();
  const lower = clean.toLowerCase();
  const timezone = extractTimezone(clean);

  // Check if "All day" or equivalent
  const isAllDay = ALL_DAY_TRIGGERS.some((trigger) => lower.includes(trigger));

  let timings: string[] = [];
  if (isAllDay) {
    timings = ["morning", "afternoon", "evening", "late night", "weekend"];
  } else {
    for (const item of TIME_REGEXES) {
      if (item.regex.test(lower)) {
        timings.push(item.key);
      }
    }
  }

  // Fallback: If user enters e.g. "mostly weekends and evenings"
  if (lower.includes("mostly weekend") && !timings.includes("weekend")) {
    timings.push("weekend");
  }

  const needsTimezoneFollowup = timings.length > 0 && timezone === null;

  let displayTiming = "Not specified";
  if (isAllDay) {
    displayTiming = "All day (Mornings, Afternoons, Evenings, Late night, Weekends)";
  } else if (timings.length > 0) {
    displayTiming = timings
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(", ");
  }

  let conversationalResponse = "";
  if (isAllDay && needsTimezoneFollowup) {
    conversationalResponse =
      "Got it — you usually play throughout the day! Which timezone should I use? For example, IST (UTC+5:30) or EST.";
  } else if (isAllDay && timezone) {
    conversationalResponse = `Awesome — marked your schedule as active throughout the day in ${timezone}.`;
  } else if (timings.length > 0 && needsTimezoneFollowup) {
    conversationalResponse = `Got your preferred times (${displayTiming}). Which timezone do you play in?`;
  } else if (timings.length > 0 && timezone) {
    conversationalResponse = `Got it — ${displayTiming} (${timezone}).`;
  } else {
    conversationalResponse =
      "I couldn't quite identify your schedule. You can say 'All day', 'Evenings and weekends', 'Mornings', or include your timezone like 'Evenings — IST'.";
  }

  return {
    raw: input,
    timings,
    displayTiming,
    timezone,
    isAllDay,
    needsTimezoneFollowup,
    conversationalResponse
  };
}

// ── 2. Looking For Preferences Parsing ──────────────────────────────────────

const ALL_LOOKING_FOR = [
  "Casual friends",
  "Ranked squad",
  "Chill VC",
  "Co-op"
];

const ALL_LOOKING_FOR_TRIGGERS = [
  "all", "everything", "anything", "all of them", "all of it", "both",
  "all 4", "every", "all options", "everything listed", "any"
];

export function parseLookingFor(input: string): ParsedLookingFor {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // Check for whole-choice words like "all" or "everything"
  const isAll = ALL_LOOKING_FOR_TRIGGERS.some((trig) => {
    const rx = new RegExp(`(^|\\b)${trig}(\\b|$)`, "i");
    return rx.test(lower);
  });

  if (isAll) {
    return {
      raw: input,
      preferences: [...ALL_LOOKING_FOR],
      isAll: true,
      conversationalResponse:
        "Sounds like you're open to everything! I've selected all four preferences: Casual friends, Ranked squad, Chill VC, and Co-op."
    };
  }

  const matches: string[] = [];

  if (/\b(casual|friends?|hangout|just\s*chilling|social)\b/i.test(lower)) {
    if (!matches.includes("Casual friends")) matches.push("Casual friends");
  }
  if (/\b(ranked|competitive|comp|sweat|sweaty|ranked\s*squad)\b/i.test(lower)) {
    if (!matches.includes("Ranked squad")) matches.push("Ranked squad");
  }
  if (/\b(chill\s*vc|voice|vc|chat|chill|chilling)\b/i.test(lower)) {
    if (!matches.includes("Chill VC")) matches.push("Chill VC");
  }
  if (/\b(co-?op|coop|pve|teamwork|campaign)\b/i.test(lower)) {
    if (!matches.includes("Co-op")) matches.push("Co-op");
  }

  let conversationalResponse = "";
  if (matches.length > 0) {
    conversationalResponse = `Nice! Selected: ${matches.join(", ")}.`;
  } else {
    conversationalResponse =
      "I couldn't identify that preference. You can choose casual, ranked, co-op, chill VC, or say 'all' for everything.";
  }

  return {
    raw: input,
    preferences: matches,
    isAll: false,
    conversationalResponse
  };
}

// ── 3. Gender Parsing ───────────────────────────────────────────────────────

const GENDER_MALE_TRIGGERS = ["male", "m", "man", "guy", "boy", "he", "him"];
const GENDER_FEMALE_TRIGGERS = ["female", "f", "woman", "girl", "she", "her"];
const GENDER_NB_TRIGGERS = ["non-binary", "nonbinary", "nb", "enby", "they", "them"];
const GENDER_SKIP_TRIGGERS = [
  "prefer not to say", "skip", "pass", "none", "private", "not now"
];

export function parseGender(input: string): ParsedGender {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  if (GENDER_SKIP_TRIGGERS.some((trig) => lower === trig || lower.startsWith(trig))) {
    return {
      raw: input,
      gender: null,
      isSkipped: true,
      isValid: true,
      conversationalResponse: "Understood, kept private."
    };
  }

  if (GENDER_MALE_TRIGGERS.some((trig) => lower === trig)) {
    return {
      raw: input,
      gender: "Male",
      isSkipped: false,
      isValid: true,
      conversationalResponse: "Recorded as Male."
    };
  }

  if (GENDER_FEMALE_TRIGGERS.some((trig) => lower === trig)) {
    return {
      raw: input,
      gender: "Female",
      isSkipped: false,
      isValid: true,
      conversationalResponse: "Recorded as Female."
    };
  }

  if (GENDER_NB_TRIGGERS.some((trig) => lower === trig)) {
    return {
      raw: input,
      gender: "Non-binary",
      isSkipped: false,
      isValid: true,
      conversationalResponse: "Recorded as Non-binary."
    };
  }

  return {
    raw: input,
    gender: null,
    isSkipped: false,
    isValid: false,
    conversationalResponse:
      "Please choose Male, Female, Non-binary, or say 'skip' to keep this private."
  };
}

// ── 4. Natural Game Parsing ─────────────────────────────────────────────────

const KNOWN_GAMES_DEFAULT = [
  { name: "Apex Legends", slug: "apex-legends", aliases: ["apex", "apex legends", "al"] },
  { name: "Palworld", slug: "palworld", aliases: ["palworld", "pal"] },
  { name: "Minecraft", slug: "minecraft", aliases: ["minecraft", "mc"] },
  { name: "Valorant", slug: "valorant", aliases: ["valorant", "val", "valo"] },
  { name: "Fortnite", slug: "fortnite", aliases: ["fortnite", "fn"] },
  { name: "PUBG: Battlegrounds", slug: "pubg", aliases: ["pubg", "pubg battlegrounds"] },
  { name: "Warframe", slug: "warframe", aliases: ["warframe", "wf"] },
  { name: "Destiny 2", slug: "destiny-2", aliases: ["destiny 2", "destiny", "d2"] },
  { name: "Helldivers 2", slug: "helldivers-2", aliases: ["helldivers 2", "helldivers", "hd2"] },
  { name: "GTA Online", slug: "gta-online", aliases: ["gta online", "gta", "gta v", "gta 5"] },
  { name: "Monster Hunter Wilds", slug: "monster-hunter-wilds", aliases: ["monster hunter wilds", "monster hunter", "mhw", "mh wilds"] }
];

const PLATFORM_REGEX = /\b(PC|PlayStation|PS5|PS4|Xbox|Mobile|Nintendo\s*Switch|Switch|Console)\b/i;
const SKILL_REGEX = /\b(Beginner|Novice|Intermediate|Advanced|Pro|Competitive|Casual)\b/i;

export function parseGamesNatural(input: string, catalog = KNOWN_GAMES_DEFAULT): ParsedGamesResult {
  const clean = input.trim();
  // Split on newlines, semicolons, or " and "
  const rawSegments = clean
    .split(/\n|;|\band\b|,\s*/i)
    .map((s) => s.replace(/^(i\s*play|playing|games?:\s*)/i, "").trim())
    .filter(Boolean);

  const games: ParsedGameItem[] = [];
  const unlistedGames: string[] = [];

  for (const seg of rawSegments) {
    if (!seg) continue;

    // Check if delimiter format was used: "Game — Platform — Skill"
    const parts = seg.split(/\s*(?:—|\|)\s*/);
    let candidateName = parts[0].trim();
    let platformFromDelimiter = parts[1]?.trim();
    let skillFromDelimiter = parts[2]?.trim();

    // Check if platform/skill was embedded in the string
    const platMatch = seg.match(PLATFORM_REGEX);
    const skillMatch = seg.match(SKILL_REGEX);

    const platform = platformFromDelimiter || (platMatch ? normalizePlatform(platMatch[1]) : undefined);
    const skill = skillFromDelimiter || (skillMatch ? normalizeSkill(skillMatch[1]) : undefined);

    // Strip platform and skill words out of candidate name to find clean game name
    if (!parts[1]) {
      if (platMatch) candidateName = candidateName.replace(platMatch[0], "").trim();
      if (skillMatch) candidateName = candidateName.replace(skillMatch[0], "").trim();
    }

    const matchedKnown = catalog.find((g) =>
      g.aliases.some((alias) => alias.toLowerCase() === candidateName.toLowerCase()) ||
      g.name.toLowerCase() === candidateName.toLowerCase()
    );

    if (matchedKnown) {
      games.push({
        game: matchedKnown.name,
        slug: matchedKnown.slug,
        platform,
        skill,
        missingPlatform: platform === undefined,
        missingSkill: skill === undefined
      });
    } else if (candidateName.length >= 2) {
      // Custom / Unlisted Game
      const slug = candidateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      games.push({
        game: candidateName,
        slug,
        platform,
        skill,
        missingPlatform: platform === undefined,
        missingSkill: skill === undefined
      });
      unlistedGames.push(candidateName);
    }
  }

  let conversationalResponse = "";
  if (games.length > 0) {
    const missingPlatCount = games.filter((g) => g.missingPlatform).length;
    if (missingPlatCount > 0) {
      conversationalResponse = `Great choice with ${games.map((g) => g.game).join(", ")}! What platform do you play on?`;
    } else {
      conversationalResponse = `Identified: ${games.map((g) => g.game).join(", ")}.`;
    }
  } else {
    conversationalResponse =
      "I couldn't identify any games from that text. You can type game names (e.g. 'Apex, Minecraft') or use the dropdown menus.";
  }

  return {
    raw: input,
    games,
    unlistedGames,
    conversationalResponse
  };
}

function normalizePlatform(p: string): string {
  const l = p.toLowerCase();
  if (l.includes("ps") || l.includes("playstation")) return "PlayStation";
  if (l.includes("xbox")) return "Xbox";
  if (l.includes("switch")) return "Nintendo Switch";
  if (l.includes("mobile") || l.includes("phone")) return "Mobile";
  return "PC";
}

function normalizeSkill(s: string): string {
  const l = s.toLowerCase();
  if (l.includes("pro") || l.includes("comp") || l.includes("adv")) return "Competitive";
  if (l.includes("beg") || l.includes("nov")) return "Beginner";
  return "Intermediate";
}

// ── 5. Confirmation Summary Builder ─────────────────────────────────────────

export function buildConfirmationSummary(answers: Record<string, any>): ConfirmationSummaryData {
  const isMinor = answers.age_group === "minor";
  const ageClassificationStr = isMinor ? "Teen Member" : "18+ Member";

  let gamesStr = "None selected";
  let platformsStr = "None specified";
  let skillLevelsStr = "None specified";

  if (Array.isArray(answers.games) && answers.games.length > 0) {
    gamesStr = answers.games
      .map((g: any) => `${g.game}${g.platform ? ` (${g.platform})` : ""}`)
      .join(", ");

    const plats = Array.from(new Set(answers.games.map((g: any) => g.platform).filter(Boolean)));
    platformsStr = plats.length > 0 ? plats.join(", ") : "Not specified";

    const skills = Array.from(new Set(answers.games.map((g: any) => g.skill).filter(Boolean)));
    skillLevelsStr = skills.length > 0 ? skills.join(", ") : "Not specified";
  }

  const scheduleStr = answers.timing_display || answers.timing || "Not specified";
  const timezoneStr = answers.timezone || "Not specified";

  let lookingForStr = "Community & Co-op";
  if (Array.isArray(answers.looking_preferences) && answers.looking_preferences.length > 0) {
    lookingForStr = answers.looking_preferences.join(", ");
  } else if (answers.looking) {
    lookingForStr = answers.looking;
  }

  const voiceLanguageStr = answers.language || "Skipped / Any";

  return {
    gamesStr,
    platformsStr,
    skillLevelsStr,
    scheduleStr,
    timezoneStr,
    lookingForStr,
    voiceLanguageStr,
    ageClassificationStr,
    isMinor
  };
}

export function formatConfirmationCard(data: ConfirmationSummaryData): string {
  return [
    `📋 **Profile Summary — Please Confirm**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎮 **Games:** ${data.gamesStr}`,
    `🕹️ **Platforms:** ${data.platformsStr}`,
    `⚡ **Skill Levels:** ${data.skillLevelsStr}`,
    `⏰ **Play Schedule:** ${data.scheduleStr}`,
    `🌍 **Timezone:** ${data.timezoneStr}`,
    `🎯 **Looking For:** ${data.lookingForStr}`,
    `🗣️ **Voice Language:** ${data.voiceLanguageStr}`,
    `🛡️ **Age Classification:** ${data.ageClassificationStr} *(Self-reported)*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*Your age classification is self-reported and kept private to isolate youth and adult channels.*`,
    `\n**Does everything look correct?**`
  ].join("\n");
}

// ── 6. Sensitive Data Leak Detection & Age Validation ─────────────────────

/**
 * Detects whether a message posted in public chat contains sensitive verification
 * data (e.g. personal age disclosure or gender onboarding answers), while allowing
 * harmless gaming messages like "I play Apex 2" or "Looking for 5 teammates".
 */
export function detectSensitiveLeak(text: string): { isLeak: boolean; reason?: string } {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Standalone age number in plausible age range (e.g. "21", "15", "18")
  // Excludes single digits 0-9 unless prefixed by "age"
  if (/^\s*(?:1[0-9]|[2-9][0-9]|100)\s*$/.test(clean)) {
    return { isLeak: true, reason: "Standalone age disclosure in public chat" };
  }

  // 2. Explicit age statements (e.g. "I am 21 years old", "I'm 16 yo", "my age is 19")
  if (/\b(?:i(?:'m| am)?\s*(?:currently\s*)?)(\d{1,2})\s*(?:years?\s*old|yo|y\/o)\b/i.test(clean)) {
    return { isLeak: true, reason: "Explicit age statement in public chat" };
  }
  if (/\bmy\s+age\s+(?:is\s+)?(\d{1,2})\b/i.test(clean)) {
    return { isLeak: true, reason: "Explicit age statement in public chat" };
  }
  if (/^\s*age\s*[:=]\s*\d{1,2}\s*$/i.test(clean)) {
    return { isLeak: true, reason: "Explicit age statement in public chat" };
  }

  // 3. Explicit standalone gender statements in response to onboarding
  // e.g. "Male", "Female", "Non-binary", "I am male"
  // Does NOT match "I like playing female operators in R6" or "male characters"
  if (/^\s*(?:i(?:'m| am)\s+)?(?:a\s+)?(male|female|non-binary|enby)\s*$/i.test(clean)) {
    return { isLeak: true, reason: "Standalone gender statement in public chat" };
  }
  if (/\bmy\s+gender\s+(?:is\s+)?(male|female|non-binary)\b/i.test(clean)) {
    return { isLeak: true, reason: "Explicit gender statement in public chat" };
  }

  // Everything else (e.g. "I play Apex 2", "need 5 teammates", "Age of Empires 4", "Dota 2") is NOT a leak
  return { isLeak: false };
}

export interface AgeValidationResult {
  valid: boolean;
  ageGroup?: "minor" | "adult";
  error?: string;
  isUnderage?: boolean;
}

/**
 * Validates age input with strict integer checks, boundaries, and under-13 protections.
 * Never stores or returns the raw age number.
 */
export function validateAgeInput(rawAge: string): AgeValidationResult {
  const clean = rawAge.trim();

  // Strict integer check: only digits, no decimals, no text, no negatives
  if (!/^\d+$/.test(clean)) {
    return {
      valid: false,
      error: "Please enter your age as a whole number only (e.g. 21)."
    };
  }

  const ageNum = Number(clean);

  if (ageNum < 13) {
    return {
      valid: false,
      isUnderage: true,
      error: "In accordance with Discord terms of service, members must be at least 13 years old to join this community."
    };
  }

  if (ageNum > 100) {
    return {
      valid: false,
      error: "Please enter a realistic age between 13 and 100."
    };
  }

  // Boundary checks:
  // 13-17: Minor
  // 18+: Adult
  const ageGroup = ageNum < 18 ? "minor" : "adult";

  return {
    valid: true,
    ageGroup
  };
}
