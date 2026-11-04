import { test } from "node:test";
import assert from "node:assert";
import {
  ONBOARDING_MAPPING_RULES,
  resolveOnboardingRoleMapping
} from "../onboarding-roles.js";
import { NativeOnboardingProvisioner } from "../native-onboarding.js";

test("ONBOARDING_MAPPING_RULES contains exactly 24 rules across 3 categories", () => {
  assert.strictEqual(ONBOARDING_MAPPING_RULES.length, 24);

  const gameRules = ONBOARDING_MAPPING_RULES.filter((r) => r.category === "game");
  const platformRules = ONBOARDING_MAPPING_RULES.filter((r) => r.category === "platform");
  const expRules = ONBOARDING_MAPPING_RULES.filter((r) => r.category === "experience");

  assert.strictEqual(gameRules.length, 12, "Must have 12 game options");
  assert.strictEqual(platformRules.length, 5, "Must have 5 platform options");
  assert.strictEqual(expRules.length, 7, "Must have 7 experience options");

  // Verify specific game mappings
  const expectedGames: Record<string, string> = {
    "Apex Legends": "Apex Squad",
    "Palworld": "Palworld Crew",
    "Minecraft": "Minecraft Crew",
    "Valorant": "Valorant Squad",
    "Fortnite": "Fortnite Crew",
    "PUBG": "PUBG Squad",
    "Warframe": "Warframe Crew",
    "Destiny 2": "Destiny 2 Crew",
    "Helldivers 2": "Helldivers Crew",
    "GTA Online": "GTA Online Crew",
    "Monster Hunter Wilds": "Monster Hunter Crew",
    "Other": "Other Games"
  };

  for (const [option, role] of Object.entries(expectedGames)) {
    const match = gameRules.find((r) => r.option === option);
    assert.ok(match, `Missing game rule for option: ${option}`);
    assert.strictEqual(match.roleName, role, `Option ${option} must map to role ${role}`);
  }

  // Verify platform mappings
  const expectedPlatforms: Record<string, string> = {
    "PC": "PC Gamer",
    "PlayStation": "PlayStation Gamer",
    "Xbox": "Xbox Gamer",
    "Mobile": "Mobile Gamer",
    "Nintendo Switch": "Nintendo Switch Gamer"
  };

  for (const [option, role] of Object.entries(expectedPlatforms)) {
    const match = platformRules.find((r) => r.option === option);
    assert.ok(match, `Missing platform rule for option: ${option}`);
    assert.strictEqual(match.roleName, role, `Option ${option} must map to role ${role}`);
  }

  // Verify experience mappings
  const expectedExp: Record<string, string> = {
    "Competitive": "Competitive",
    "Casual": "Casual Gamer",
    "Co-op": "Co-op Gamer",
    "Survival": "Survival Gamer",
    "RPG": "RPG Gamer",
    "Horror": "Horror Gamer",
    "Social gaming": "Social Gamer"
  };

  for (const [option, role] of Object.entries(expectedExp)) {
    const match = expRules.find((r) => r.option === option);
    assert.ok(match, `Missing experience rule for option: ${option}`);
    assert.strictEqual(match.roleName, role, `Option ${option} must map to role ${role}`);
  }
});

test("resolveOnboardingRoleMapping succeeds when all roles exist and are below bot hierarchy", () => {
  // Bot at position 50, all 24 roles at positions 1-24
  const mockRoles = ONBOARDING_MAPPING_RULES.map((rule, idx) => ({
    id: `role_id_${idx + 1}`,
    name: rule.roleName,
    position: idx + 1
  }));

  const botPosition = 50;
  const resolution = resolveOnboardingRoleMapping(mockRoles, botPosition);

  assert.strictEqual(resolution.ready, true, "Resolution should be ready");
  assert.strictEqual(resolution.missingRoles.length, 0);
  assert.strictEqual(resolution.unassignableRoles.length, 0);
  assert.strictEqual(resolution.prohibitedRoles.length, 0);
  assert.strictEqual(resolution.items.length, 24);
  assert.strictEqual(resolution.optionToRoleId.size, 24);

  // Check specific mapping in map
  assert.strictEqual(resolution.optionToRoleId.get("apex legends"), "role_id_1");
  assert.strictEqual(resolution.optionToRoleId.get("pc"), "role_id_13");
});

test("resolveOnboardingRoleMapping identifies missing roles and marks ready: false", () => {
  // Only provide roles for first 5 rules
  const mockRoles = ONBOARDING_MAPPING_RULES.slice(0, 5).map((rule, idx) => ({
    id: `role_id_${idx + 1}`,
    name: rule.roleName,
    position: idx + 1
  }));

  const botPosition = 50;
  const resolution = resolveOnboardingRoleMapping(mockRoles, botPosition);

  assert.strictEqual(resolution.ready, false, "Resolution should not be ready with missing roles");
  assert.strictEqual(resolution.missingRoles.length, 19, "19 roles should be missing");
  assert.strictEqual(resolution.optionToRoleId.size, 5, "5 roles should be mapped");

  const missingItem = resolution.items.find((i) => i.status === "MISSING");
  assert.ok(missingItem);
  assert.strictEqual(missingItem.assignable, false);
});

test("resolveOnboardingRoleMapping rejects roles at or above bot position hierarchy", () => {
  // Bot at position 10. Role 1 is at position 12 (higher than bot).
  const mockRoles = ONBOARDING_MAPPING_RULES.map((rule, idx) => ({
    id: `role_id_${idx + 1}`,
    name: rule.roleName,
    position: idx === 0 ? 12 : 5 // First role is above bot position
  }));

  const botPosition = 10;
  const resolution = resolveOnboardingRoleMapping(mockRoles, botPosition);

  assert.strictEqual(resolution.ready, false);
  assert.strictEqual(resolution.unassignableRoles.length, 1);
  assert.strictEqual(resolution.unassignableRoles[0], ONBOARDING_MAPPING_RULES[0].roleName);

  const unassignableItem = resolution.items.find((i) => i.status === "UNASSIGNABLE");
  assert.ok(unassignableItem);
  assert.strictEqual(unassignableItem.assignable, false);
});

test("buildStandardGamingPrompts attaches role_ids when optionToRoleId map is supplied", () => {
  const provisioner = new NativeOnboardingProvisioner("fake_token", "fake_guild");

  const optionToRoleId = new Map<string, string>([
    ["apex legends", "role_apex_123"],
    ["pc", "role_pc_456"],
    ["competitive", "role_comp_789"]
  ]);

  const prompts = provisioner.buildStandardGamingPrompts("chan_verify_999", optionToRoleId);
  assert.strictEqual(prompts.length, 3);

  // Prompt 1: Games
  const p1 = prompts[0];
  const apexOption = p1.options.find((o) => o.title === "Apex Legends");
  assert.ok(apexOption);
  assert.deepStrictEqual(apexOption.role_ids, ["role_apex_123"]);
  assert.deepStrictEqual(apexOption.channel_ids, ["chan_verify_999"]);

  // Option without mapping has empty role_ids
  const mcOption = p1.options.find((o) => o.title === "Minecraft");
  assert.ok(mcOption);
  assert.deepStrictEqual(mcOption.role_ids, []);
  assert.deepStrictEqual(mcOption.channel_ids, ["chan_verify_999"]);

  // Prompt 2: Platforms
  const p2 = prompts[1];
  const pcOption = p2.options.find((o) => o.title === "PC");
  assert.ok(pcOption);
  assert.deepStrictEqual(pcOption.role_ids, ["role_pc_456"]);

  // Prompt 3: Gaming Experience
  const p3 = prompts[2];
  const compOption = p3.options.find((o) => o.title === "Competitive");
  assert.ok(compOption);
  assert.deepStrictEqual(compOption.role_ids, ["role_comp_789"]);
});

