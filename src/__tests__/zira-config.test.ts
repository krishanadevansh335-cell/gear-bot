import { test } from "node:test";
import assert from "node:assert";
import { ZIRA_PANELS, resolveZiraPanels, ZIRA_RESTRICTED_ROLES } from "../zira-config.js";

test("ZIRA_PANELS defines exactly 4 panels with correct multi-select and channel settings", () => {
  assert.strictEqual(ZIRA_PANELS.length, 4);

  const [games, platforms, prefs, notifs] = ZIRA_PANELS;

  assert.strictEqual(games.id, "panel_games");
  assert.strictEqual(games.channelName, "choose-roles");
  assert.strictEqual(games.multiSelect, true);
  assert.strictEqual(games.items.length, 12, "Panel 1 must have 12 game options");

  assert.strictEqual(platforms.id, "panel_platform");
  assert.strictEqual(platforms.channelName, "choose-roles");
  assert.strictEqual(platforms.multiSelect, true);
  assert.strictEqual(platforms.items.length, 5, "Panel 2 must have 5 platform options");

  assert.strictEqual(prefs.id, "panel_preferences");
  assert.strictEqual(prefs.channelName, "choose-roles");
  assert.strictEqual(prefs.multiSelect, true);
  assert.strictEqual(prefs.items.length, 7, "Panel 3 must have 7 preference options");

  assert.strictEqual(notifs.id, "panel_notifications");
  assert.strictEqual(notifs.channelName, "choose-roles");
  assert.strictEqual(notifs.multiSelect, true);
  assert.strictEqual(notifs.items.length, 5, "Panel 4 must have 5 notification options");
});

test("resolveZiraPanels correctly identifies missing notification roles while resolving existing preference roles", () => {
  // Existing 24 preference roles
  const mockRoles = [
    { id: "r_1", name: "Apex Squad", position: 10 },
    { id: "r_2", name: "Palworld Crew", position: 10 },
    { id: "r_3", name: "Minecraft Crew", position: 10 },
    { id: "r_4", name: "Valorant Squad", position: 10 },
    { id: "r_5", name: "Fortnite Crew", position: 10 },
    { id: "r_6", name: "PUBG Squad", position: 10 },
    { id: "r_7", name: "Warframe Crew", position: 10 },
    { id: "r_8", name: "Destiny 2 Crew", position: 10 },
    { id: "r_9", name: "Helldivers Crew", position: 10 },
    { id: "r_10", name: "GTA Online Crew", position: 10 },
    { id: "r_11", name: "Monster Hunter Crew", position: 10 },
    { id: "r_12", name: "Other Games", position: 10 },
    { id: "r_13", name: "PC Gamer", position: 10 },
    { id: "r_14", name: "PlayStation Gamer", position: 10 },
    { id: "r_15", name: "Xbox Gamer", position: 10 },
    { id: "r_16", name: "Mobile Gamer", position: 10 },
    { id: "r_17", name: "Nintendo Switch Gamer", position: 10 },
    { id: "r_18", name: "Competitive", position: 10 },
    { id: "r_19", name: "Casual Gamer", position: 10 },
    { id: "r_20", name: "Co-op Gamer", position: 10 },
    { id: "r_21", name: "Survival Gamer", position: 10 },
    { id: "r_22", name: "RPG Gamer", position: 10 },
    { id: "r_23", name: "Horror Gamer", position: 10 },
    { id: "r_24", name: "Social Gamer", position: 10 }
  ];

  const report = resolveZiraPanels(mockRoles);

  assert.strictEqual(report.ready, false, "Should be pending because notification roles are missing");
  assert.strictEqual(report.missingRoles.length, 5);
  assert.deepStrictEqual(report.missingRoles, [
    "Game Events",
    "Tournaments",
    "Announcements",
    "Giveaways",
    "Game Updates"
  ]);
  assert.strictEqual(report.restrictedViolations.length, 0);

  // Check that games, platforms, preferences are READY
  const apex = report.items.find((i) => i.targetRoleName === "Apex Squad");
  assert.ok(apex);
  assert.strictEqual(apex.status, "READY");
  assert.strictEqual(apex.roleId, "r_1");
});

test("Zira security guardrails strictly prohibit clearance roles", () => {
  assert.ok(ZIRA_RESTRICTED_ROLES.includes("Verified Member"));
  assert.ok(ZIRA_RESTRICTED_ROLES.includes("Teen Member"));
  assert.ok(ZIRA_RESTRICTED_ROLES.includes("18+ Member"));
  assert.ok(ZIRA_RESTRICTED_ROLES.includes("Staff"));
});

