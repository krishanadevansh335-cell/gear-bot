import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GameDatabase } from "../game-db.js";
import { NativeOnboardingProvisioner, DEFAULT_PROHIBITED_ROLES } from "../native-onboarding.js";
import { DiscordProvisioner } from "../provisioner.js";

// Helper for temporary test DB path
function createTestDb(name: string): { db: GameDatabase; dbPath: string } {
  const dbPath = path.resolve(process.cwd(), `data/test-${name}.db`);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = new GameDatabase(dbPath);
  return { db, dbPath };
}

function cleanupDb(db: GameDatabase, dbPath: string) {
  try { db.close(); } catch {}
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

// ── 1. Duplicate Gateway Events ───────────────────────────────────────────────
test("1. Duplicate gateway events do not reset verification progress", () => {
  const { db, dbPath } = createTestDb("dup-events");
  try {
    const guildId = "guild_101";
    const userId = "user_202";

    // 1st event: user accepts rules -> session created
    const first = db.getOrCreateVerificationSession(guildId, userId);
    assert.equal(first.created, true);
    assert.equal(first.session.step, "agree");

    // User progresses through questions
    db.updateVerificationSession(guildId, userId, {
      step: "age",
      answers: { age_group: "adult", age_confirmed: true }
    });

    // 2nd duplicate gateway event fires (Discord gateway replay)
    const duplicate = db.getOrCreateVerificationSession(guildId, userId);
    assert.equal(duplicate.created, false, "Must not create a new session on duplicate event");
    assert.equal(duplicate.session.step, "age", "Must not reset step to agree");
    assert.equal(duplicate.session.answers.age_group, "adult", "Must preserve existing answers");
  } finally {
    cleanupDb(db, dbPath);
  }
});

// ── 2. Concurrent Session Creation ────────────────────────────────────────────
test("2. Concurrent session creation creates exactly one session", async () => {
  const { db, dbPath } = createTestDb("concurrent-session");
  try {
    const guildId = "guild_concur";
    const userId = "user_concur";

    // Simulate 10 simultaneous events attempting session creation
    const attempts = Array.from({ length: 10 }, () =>
      db.getOrCreateVerificationSession(guildId, userId)
    );

    const createdCount = attempts.filter(a => a.created).length;
    assert.equal(createdCount, 1, "Exactly one concurrent call should report created=true");

    const allSessionIds = new Set(attempts.map(a => a.session.id));
    assert.equal(allSessionIds.size, 1, "All concurrent attempts must return the exact same session row ID");
  } finally {
    cleanupDb(db, dbPath);
  }
});

// ── 3. Multiple Bot Processes ─────────────────────────────────────────────────
test("3. Multiple bot processes share and synchronize persistent sessions", () => {
  const dbPath = path.resolve(process.cwd(), "data/test-multi-process.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const procA = new GameDatabase(dbPath);
  const procB = new GameDatabase(dbPath);

  try {
    const guildId = "guild_shared";
    const userId = "user_shared";

    // Process A initiates session
    const aInit = procA.getOrCreateVerificationSession(guildId, userId);
    assert.equal(aInit.created, true);

    // Process A advances to 'games'
    procA.updateVerificationSession(guildId, userId, {
      step: "games",
      answers: { age_group: "minor", age_confirmed: true }
    });

    // Process B handles next interaction for same user
    const bFetch = procB.getVerificationSession(guildId, userId);
    assert.ok(bFetch);
    assert.equal(bFetch.step, "games", "Process B must see updates made by Process A");
    assert.equal(bFetch.answers.age_group, "minor");

    // Process B completes session
    procB.completeVerificationSession(guildId, userId);

    // Process A attempts getOrCreate - must not recreate completed session
    const aRecreate = procA.getOrCreateVerificationSession(guildId, userId);
    assert.equal(aRecreate.created, false);
    assert.equal(aRecreate.session.status, "completed");
  } finally {
    try { procA.close(); } catch {}
    try { procB.close(); } catch {}
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
});

// ── 4. Restart Recovery ───────────────────────────────────────────────────────
test("4. Restart recovery preserves partial answers and resumes in-progress sessions", () => {
  const dbPath = path.resolve(process.cwd(), "data/test-restart-recovery.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  let db = new GameDatabase(dbPath);
  const guildId = "guild_restart";
  const userId = "user_restart";

  // Pre-crash: user is mid-flow at 'looking'
  db.getOrCreateVerificationSession(guildId, userId);
  db.updateVerificationSession(guildId, userId, {
    step: "looking",
    answers: {
      age_group: "adult",
      age_confirmed: true,
      timing: "Evening, weekends — IST",
      games: [{ game: "Apex Legends", platform: "PC", skill: "Intermediate" }]
    }
  });

  // Bot crashes / restarts
  db.close();
  db = new GameDatabase(dbPath);

  try {
    const active = db.getAllActiveVerificationSessions(guildId);
    assert.equal(active.length, 1, "Must recover active session on restart");
    const restored = active[0];
    assert.equal(restored.step, "looking");
    assert.equal(restored.answers.age_group, "adult");
    assert.equal(restored.answers.timing, "Evening, weekends — IST");
    assert.equal(restored.answers.games?.[0]?.game, "Apex Legends");
  } finally {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
});

// ── 5. Incorrect Channel Parent Detection ─────────────────────────────────────
test("5. Incorrect channel parent detection identifies misparented channels", async () => {
  const mockWrongCategory = { id: "cat_wrong", name: "OTHER CAT", type: 4, permissionsFor: () => ({ has: () => true }) };
  const mockCorrectCategory = { id: "cat_minor", name: "MINOR COMMUNITY", type: 4, permissionsFor: () => ({ has: () => true }) };

  const mockChannel = {
    name: "minor-community",
    id: "ch_minor_1",
    type: 0, // 0 = ChannelType.GuildText
    parentId: "cat_wrong",
    parent: mockWrongCategory,
    setParent: async (id: string) => { mockChannel.parentId = id; },
    lockPermissions: async () => {},
    permissionsFor: () => ({ has: () => false })
  };

  const mockGuild = {
    channels: {
      fetch: async () => new Map(),
      cache: new Map([
        ["cat_wrong", mockWrongCategory],
        ["cat_minor", mockCorrectCategory],
        ["ch_minor_1", mockChannel]
      ])
    },
    roles: {
      fetch: async () => new Map(),
      cache: new Map([
        ["r_minor", { id: "r_minor", name: "Minor 13-17" }],
        ["r_adult", { id: "r_adult", name: "Adult 18+" }],
        ["r_staff", { id: "r_staff", name: "Staff" }],
        ["r_verified", { id: "r_verified", name: "Verified" }]
      ]),
      everyone: { id: "everyone_123", name: "@everyone" }
    },
    members: {
      fetchMe: async () => ({
        permissions: { has: () => true },
        roles: { highest: { name: "BotAdmin", position: 10 } }
      })
    }
  };

  const provisioner = new DiscordProvisioner({ getGuild: () => mockGuild } as any);
  // Preview mode: reports what needs moving without modifying
  const previewReport = await provisioner.provisionServer(true);
  const reparentAction = previewReport.successfulOverwrites.find(o =>
    o.includes("Would re-parent #minor-community from [OTHER CAT] to category [MINOR COMMUNITY]")
  );
  assert.ok(reparentAction, "Must detect channel in wrong parent category and plan move");
});

// ── 6. Minor Positive Access ──────────────────────────────────────────────────
test("6. Minor positive access: flags FAIL if minor cannot access minor channel", async () => {
  // Simulated failure: Minor lacks access to minor channel
  const mockMinorChannel = {
    name: "minor-community",
    id: "minor_ch",
    parent: { name: "MINOR COMMUNITY" },
    permissionsFor: (r: any) => ({
      has: () => (r.name === "Staff" ? true : false) // Minor is FALSE!
    })
  };

  const mockGuild = {
    channels: { fetch: async () => new Map(), cache: new Map([["minor_ch", mockMinorChannel]]) },
    roles: {
      fetch: async () => new Map(),
      cache: new Map([
        ["r_min", { name: "Minor 13-17", id: "r_min" }],
        ["r_ad", { name: "Adult 18+", id: "r_ad" }],
        ["r_st", { name: "Staff", id: "r_st" }]
      ]),
      everyone: { id: "e", name: "@everyone" }
    },
    members: { fetchMe: async () => ({ permissions: { has: () => true }, roles: { highest: { name: "B", position: 5 } } }) }
  };

  const provisioner = new DiscordProvisioner({ getGuild: () => mockGuild } as any);
  const report = await provisioner.provisionServer(true);
  const audit = report.accessAudit.find(a => a.channelName === "minor-community");

  assert.ok(audit);
  assert.equal(audit.positiveChecksPassed, false);
  assert.equal(audit.isolationCompliant, false);
  assert.ok(audit.isolationNotes?.includes("cannot access minor channel"));
});

// ── 7. Minor Negative Access ──────────────────────────────────────────────────
test("7. Minor negative access: flags CRITICAL LEAK if minor can access adult channel", async () => {
  const mockAdultChannel = {
    name: "adult-community",
    id: "adult_ch",
    parent: { name: "ADULT COMMUNITY" },
    permissionsFor: (r: any) => ({
      has: () => (r.name === "Minor 13-17" || r.name === "Teen Member" || r.name === "Adult 18+" || r.name === "Staff") // Minor LEAK!
    })
  };

  const mockGuild = {
    channels: { fetch: async () => new Map(), cache: new Map([["adult_ch", mockAdultChannel]]) },
    roles: {
      fetch: async () => new Map(),
      cache: new Map([
        ["r_min", { name: "Minor 13-17", id: "r_min" }],
        ["r_ad", { name: "Adult 18+", id: "r_ad" }],
        ["r_st", { name: "Staff", id: "r_st" }]
      ]),
      everyone: { id: "e", name: "@everyone" }
    },
    members: { fetchMe: async () => ({ permissions: { has: () => true }, roles: { highest: { name: "B", position: 5 } } }) }
  };

  const provisioner = new DiscordProvisioner({ getGuild: () => mockGuild } as any);
  const report = await provisioner.provisionServer(true);
  const audit = report.accessAudit.find(a => a.channelName === "adult-community");

  assert.ok(audit);
  assert.equal(audit.negativeChecksPassed, false);
  assert.equal(audit.isolationCompliant, false);
  assert.ok(audit.isolationNotes?.includes("have access to adult space"));
});

// ── 8. Adult Positive Access ──────────────────────────────────────────────────
test("8. Adult positive access: passes when adult and staff have access to adult channel", async () => {
  const mockAdultChannel = {
    name: "adult-lfg",
    id: "adult_lfg",
    parent: { name: "ADULT COMMUNITY" },
    permissionsFor: (r: any) => ({
      has: () => (r.name === "Adult 18+" || r.name === "Staff")
    })
  };

  const mockGuild = {
    channels: { fetch: async () => new Map(), cache: new Map([["adult_lfg", mockAdultChannel]]) },
    roles: {
      fetch: async () => new Map(),
      cache: new Map([
        ["r_min", { name: "Minor 13-17", id: "r_min" }],
        ["r_ad", { name: "Adult 18+", id: "r_ad" }],
        ["r_st", { name: "Staff", id: "r_st" }]
      ]),
      everyone: { id: "e", name: "@everyone" }
    },
    members: { fetchMe: async () => ({ permissions: { has: () => true }, roles: { highest: { name: "B", position: 5 } } }) }
  };

  const provisioner = new DiscordProvisioner({ getGuild: () => mockGuild } as any);
  const report = await provisioner.provisionServer(true);
  const audit = report.accessAudit.find(a => a.channelName === "adult-lfg");

  assert.ok(audit);
  assert.equal(audit.positiveChecksPassed, true);
  assert.equal(audit.negativeChecksPassed, true);
  assert.equal(audit.isolationCompliant, true);
});

// ── 9. Adult Negative Access ──────────────────────────────────────────────────
test("9. Adult negative access: flags CRITICAL LEAK if adult can access minor channel", async () => {
  const mockMinorChannel = {
    name: "minor-lfg",
    id: "minor_lfg",
    parent: { name: "MINOR COMMUNITY" },
    permissionsFor: (r: any) => ({
      has: () => (r.name === "Adult 18+" || r.name === "18+ Member") // Adult LEAK!
    })
  };

  const mockGuild = {
    channels: { fetch: async () => new Map(), cache: new Map([["minor_lfg", mockMinorChannel]]) },
    roles: {
      fetch: async () => new Map(),
      cache: new Map([
        ["r_min", { name: "Minor 13-17", id: "r_min" }],
        ["r_ad", { name: "Adult 18+", id: "r_ad" }],
        ["r_st", { name: "Staff", id: "r_st" }]
      ]),
      everyone: { id: "e", name: "@everyone" }
    },
    members: { fetchMe: async () => ({ permissions: { has: () => true }, roles: { highest: { name: "B", position: 5 } } }) }
  };

  const provisioner = new DiscordProvisioner({ getGuild: () => mockGuild } as any);
  const report = await provisioner.provisionServer(true);
  const audit = report.accessAudit.find(a => a.channelName === "minor-lfg");

  assert.ok(audit);
  assert.equal(audit.negativeChecksPassed, false);
  assert.equal(audit.isolationCompliant, false);
  assert.ok(audit.isolationNotes?.includes("have access to minor space"));
});

// ── 10. Staff Access ──────────────────────────────────────────────────────────
test("10. Staff access: staff accesses #mod-alerts and unverified/@everyone is blocked", async () => {
  const mockModAlerts = {
    name: "mod-alerts",
    id: "mod_alerts_ch",
    parent: { name: "STAFF" },
    permissionsFor: (r: any) => ({
      has: () => (r.name === "Staff" ? true : false)
    })
  };

  const mockGuild = {
    channels: { fetch: async () => new Map(), cache: new Map([["mod_alerts_ch", mockModAlerts]]) },
    roles: {
      fetch: async () => new Map(),
      cache: new Map([
        ["r_min", { name: "Minor 13-17", id: "r_min" }],
        ["r_ad", { name: "Adult 18+", id: "r_ad" }],
        ["r_st", { name: "Staff", id: "r_st" }],
        ["r_ver", { name: "Verified", id: "r_ver" }]
      ]),
      everyone: { id: "e", name: "@everyone" }
    },
    members: { fetchMe: async () => ({ permissions: { has: () => true }, roles: { highest: { name: "B", position: 5 } } }) }
  };

  const provisioner = new DiscordProvisioner({ getGuild: () => mockGuild } as any);
  const report = await provisioner.provisionServer(true);
  const audit = report.accessAudit.find(a => a.channelName === "mod-alerts");

  assert.ok(audit);
  assert.equal(audit.positiveChecksPassed, true, "Staff must have access");
  assert.equal(audit.negativeChecksPassed, true, "Everyone, minors and adults must be blocked");
  assert.equal(audit.isolationCompliant, true);
});

// ── 11. Sensitive Native Role Rejection ───────────────────────────────────────
test("11. Sensitive native role rejection: fails closed for every prohibited role and unresolvable ID", () => {
  const provisioner = new NativeOnboardingProvisioner("mock_token", "guild_123");

  const guildRoleMap = new Map<string, string>([
    ["id_minor", "Minor 13-17"],
    ["id_minor2", "Minor 13–17"],
    ["id_teen", "Teen Member"],
    ["id_adult", "Adult 18+"],
    ["id_18plus", "18+ Member"],
    ["id_verified", "Verified"],
    ["id_verified_member", "Verified Member"],
    ["id_staff", "Staff"],
    ["id_admin", "Admin"],
    ["id_admin2", "Administrator"],
    ["id_mod", "Moderator"],
    ["id_mod2", "Mod"],
    ["id_safe_apex", "Apex Squad"],
    ["id_safe_pal", "Palworld Crew"]
  ]);

  // Test every single prohibited role
  for (const prohibitedRole of DEFAULT_PROHIBITED_ROLES) {
    const roleId = Array.from(guildRoleMap.entries()).find(([, name]) => name.toLowerCase() === prohibitedRole.toLowerCase())?.[0] || "id_generic";
    const testPrompts = [{
      title: "Test prompt",
      single_select: false,
      required: true,
      in_onboarding: true,
      type: 0,
      options: [{ title: "Bad option", role_ids: [roleId] }]
    }];

    assert.throws(
      () => provisioner.validateNoSensitiveRoles(testPrompts, guildRoleMap),
      /Prohibited role assignment/,
      `Must reject prohibited role: ${prohibitedRole}`
    );
  }

  // Test fail-closed on unresolvable role ID
  const unresolvablePrompt = [{
    title: "Unknown role",
    single_select: false,
    required: true,
    in_onboarding: true,
    type: 0,
    options: [{ title: "Mystery option", role_ids: ["id_does_not_exist"] }]
  }];
  assert.throws(
    () => provisioner.validateNoSensitiveRoles(unresolvablePrompt, guildRoleMap),
    /cannot be resolved/i,
    "Must fail closed when role ID cannot be resolved"
  );

  // Test fail-closed on missing roleIdToName mapping
  assert.throws(
    () => provisioner.validateNoSensitiveRoles(unresolvablePrompt, undefined),
    /roleIdToName mapping was not provided/,
    "Must fail closed when mapping is undefined"
  );

  // Test safe interest role passes cleanly
  const safePrompt = [{
    title: "Games",
    single_select: false,
    required: true,
    in_onboarding: true,
    type: 0,
    options: [{ title: "Apex option", role_ids: ["id_safe_apex"] }]
  }];
  assert.doesNotThrow(
    () => provisioner.validateNoSensitiveRoles(safePrompt, guildRoleMap),
    "Harmless interest roles like Apex Squad must pass validation"
  );
});

// ── 12. Database Migration and Rollback ────────────────────────────────────────
test("12. Database migration and rollback executes cleanly", () => {
  const { db, dbPath } = createTestDb("migration-test");
  try {
    // Check initial migration v1
    db.migrate(1);
    const verCheck = (db as any).db.prepare("SELECT * FROM schema_versions WHERE version = 1").all();
    assert.equal(verCheck.length, 1);

    // Rollback to v0
    db.rollback(0);
    const rolledBack = (db as any).db.prepare("SELECT * FROM schema_versions WHERE version >= 1").all();
    assert.equal(rolledBack.length, 0);

    // Re-apply migration v1
    db.migrate(1);
    const reApplied = (db as any).db.prepare("SELECT * FROM schema_versions WHERE version = 1").all();
    assert.equal(reApplied.length, 1);
  } finally {
    cleanupDb(db, dbPath);
  }
});
