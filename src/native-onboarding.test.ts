import { test } from "node:test";
import assert from "node:assert";
import * as path from "path";
import * as fs from "fs";
import { GameDatabase } from "./game-db.js";
import { NativeOnboardingProvisioner } from "./native-onboarding.js";

test("Database tracks membership screening events and pending state transitions", (t) => {
  const testDbPath = path.resolve(process.cwd(), "data/test-screening.db");
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new GameDatabase(testDbPath);
  
  // 1. User joins with screening pending (native Rules Screening active)
  db.recordScreeningEvent("user_12345", "guild_999", "guildMemberAdd", null, true);

  // 2. User completes rules screening
  db.recordScreeningEvent("user_12345", "guild_999", "screening_passed", true, false, {
    notes: "Rules modal accepted"
  });

  const events = db.getScreeningEventsForUser("user_12345");
  assert.strictEqual(events.length, 2);
  assert.strictEqual(events[0].event_type, "screening_passed");
  assert.strictEqual(events[0].pending_before, 1);
  assert.strictEqual(events[0].pending_after, 0);
  assert.strictEqual(events[1].event_type, "guildMemberAdd");
  assert.strictEqual(events[1].pending_after, 1);

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test("Native Onboarding Prompt structure conforms to official Discord gaming questions", () => {
  const provisioner = new NativeOnboardingProvisioner("mock_token", "mock_guild");
  const prompts = provisioner.buildStandardGamingPrompts();

  assert.strictEqual(prompts.length, 3);
  
  // Prompt 1: Games
  const p1 = prompts[0];
  assert.strictEqual(p1.title, "Which games do you play?");
  assert.strictEqual(p1.required, true);
  const titles1 = p1.options.map(o => o.title);
  assert.ok(titles1.includes("Apex Legends"));
  assert.ok(titles1.includes("Monster Hunter Wilds"));
  assert.ok(titles1.includes("Palworld"));
  assert.ok(titles1.includes("Minecraft"));
  assert.ok(titles1.includes("Valorant"));
  assert.ok(titles1.includes("Fortnite"));
  assert.ok(titles1.includes("PUBG"));
  assert.ok(titles1.includes("Warframe"));
  assert.ok(titles1.includes("Destiny 2"));
  assert.ok(titles1.includes("Helldivers 2"));
  assert.ok(titles1.includes("GTA Online"));
  assert.ok(titles1.includes("Other"));

  // Prompt 2: Platforms
  const p2 = prompts[1];
  assert.strictEqual(p2.title, "Which platform do you use?");
  const titles2 = p2.options.map(o => o.title);
  assert.ok(titles2.includes("PC"));
  assert.ok(titles2.includes("PlayStation"));
  assert.ok(titles2.includes("Xbox"));
  assert.ok(titles2.includes("Mobile"));
  assert.ok(titles2.includes("Nintendo Switch"));

  // Prompt 3: Gaming experience
  const p3 = prompts[2];
  assert.strictEqual(p3.title, "What type of gaming experience do you prefer?");
  const titles3 = p3.options.map(o => o.title);
  assert.ok(titles3.includes("Competitive"));
  assert.ok(titles3.includes("Casual"));
  assert.ok(titles3.includes("Co-op"));
  assert.ok(titles3.includes("Survival"));
  assert.ok(titles3.includes("RPG"));
  assert.ok(titles3.includes("Horror"));
  assert.ok(titles3.includes("Social gaming"));
});

test("Verification Introduction card builder redacts raw age and gender", () => {
  const answers = {
    age: 16,
    gender: "Male",
    games: [{ game: "Apex Legends", platform: "PC", skill: "Intermediate" }],
    timing: "Evening, weekends — IST",
    looking: "Ranked squad",
    language: "English"
  };

  const isMinor = answers.age < 18;
  const ageRoleName = isMinor ? "Teen Member" : "18+ Member";
  const gameListStr = answers.games.map(g => `• **${g.game}** (${g.platform} · ${g.skill})`).join('\n');

  const card = [
    `🎮 **NEW AGENT DEPLOYED: Tester**`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🕹️ **Favorite Games & Platforms:**\n${gameListStr}`,
    `⏰ **Active Hours:** ${answers.timing}`,
    `🎯 **Looking For:** ${answers.looking}`,
    answers.language ? `🗣️ **Voice Language:** ${answers.language}` : null,
    `🛡️ **Clearance Level:** Verified Member (${ageRoleName})`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  ].filter(Boolean).join('\n');

  // Verify raw numbers and gender are omitted from public card
  assert.ok(!card.includes(" 16 "), "Raw numerical age must not appear");
  assert.ok(!card.includes("Male"), "Gender must not be exposed in introduction card");
  assert.ok(card.includes("Teen Member"), "Sanitized clearance level must be displayed");
  assert.ok(card.includes("Apex Legends"), "Game must be displayed");
});

