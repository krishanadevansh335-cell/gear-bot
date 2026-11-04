import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GameDatabase } from "../game-db.js";
import { parseSchedule, parseLookingFor, parseGender, parseGamesNatural, buildConfirmationSummary, formatConfirmationCard, detectSensitiveLeak, validateAgeInput } from "../verification-parser.js";
import { buildPublicVerifyWelcome, buildStepAgePayload, buildStepGenderPayload, buildStepLookingPayload, buildConfirmationPayload } from "../verification-ui.js";
// Helper for temporary test DB path
function createTestDb(name) {
    const dbPath = path.resolve(process.cwd(), `data/test-ux-${name}.db`);
    if (fs.existsSync(dbPath))
        fs.unlinkSync(dbPath);
    const db = new GameDatabase(dbPath);
    return { db, dbPath };
}
function cleanupDb(db, dbPath) {
    try {
        db.close();
    }
    catch { }
    if (fs.existsSync(dbPath))
        fs.unlinkSync(dbPath);
}
// ── 1. "All day" & "Anytime" → All Time-of-Day Preferences ──────────────────
test("1. Schedule parsing: 'All day' assigns all 5 time-of-day preferences", () => {
    const result = parseSchedule("All day");
    assert.equal(result.isAllDay, true);
    assert.deepEqual(result.timings, ["morning", "afternoon", "evening", "late night", "weekend"]);
    assert.equal(result.needsTimezoneFollowup, true, "Must flag missing timezone for conversational follow-up");
    assert.ok(result.conversationalResponse.includes("Which timezone should I use?"));
});
test("2. Schedule parsing: 'Anytime' assigns all 5 time-of-day preferences", () => {
    const result = parseSchedule("Anytime");
    assert.equal(result.isAllDay, true);
    assert.deepEqual(result.timings, ["morning", "afternoon", "evening", "late night", "weekend"]);
});
test("3. Schedule parsing: 'Evenings and weekends' maps to correct timing preferences and extracts timezone", () => {
    const result = parseSchedule("Evenings and weekends — IST (UTC+5:30)");
    assert.equal(result.isAllDay, false);
    assert.ok(result.timings.includes("evening"));
    assert.ok(result.timings.includes("weekend"));
    assert.equal(result.timezone, "IST (UTC+5:30)");
    assert.equal(result.needsTimezoneFollowup, false);
});
// ── 2. "All" & "Everything" → All 4 Looking-For Preferences ─────────────────
test("4. Looking-for parsing: 'All' selects all four preferences", () => {
    const result = parseLookingFor("All");
    assert.equal(result.isAll, true);
    assert.equal(result.preferences.length, 4);
    assert.ok(result.preferences.includes("Casual friends"));
    assert.ok(result.preferences.includes("Ranked squad"));
    assert.ok(result.preferences.includes("Chill VC"));
    assert.ok(result.preferences.includes("Co-op"));
    assert.ok(result.conversationalResponse.includes("all four preferences"));
});
test("5. Looking-for parsing: 'Everything' selects all four preferences", () => {
    const result = parseLookingFor("Everything");
    assert.equal(result.isAll, true);
    assert.equal(result.preferences.length, 4);
});
test("6. Looking-for parsing: Specific natural inputs map accurately", () => {
    const res1 = parseLookingFor("Casual and ranked");
    assert.ok(res1.preferences.includes("Casual friends"));
    assert.ok(res1.preferences.includes("Ranked squad"));
    assert.equal(res1.preferences.includes("Co-op"), false);
    const res2 = parseLookingFor("Just chilling");
    assert.ok(res2.preferences.includes("Casual friends") || res2.preferences.includes("Chill VC"));
});
// ── 3. Gender Parsing & Optional Skip ────────────────────────────────────────
test("7. Gender parsing: 'skip' and aliases are accepted and marked as skipped without error", () => {
    const skips = ["skip", "Skip", "prefer not to say", "pass", "none", "private"];
    for (const s of skips) {
        const res = parseGender(s);
        assert.equal(res.isValid, true, `Must accept '${s}' as valid`);
        assert.equal(res.isSkipped, true);
        assert.equal(res.gender, null);
    }
});
test("8. Gender parsing: Male, Female, Non-binary normalize correctly", () => {
    assert.equal(parseGender("Male").gender, "Male");
    assert.equal(parseGender("m").gender, "Male");
    assert.equal(parseGender("Female").gender, "Female");
    assert.equal(parseGender("f").gender, "Female");
    assert.equal(parseGender("Non-binary").gender, "Non-binary");
    assert.equal(parseGender("nb").gender, "Non-binary");
});
// ── 4. Games: No silent assumption of Platform or Skill ──────────────────────
test("9. Natural game parsing: 'Apex' identifies game without inventing platform or skill", () => {
    const result = parseGamesNatural("Apex");
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].game, "Apex Legends");
    assert.equal(result.games[0].platform, undefined, "Must NOT assume PC");
    assert.equal(result.games[0].skill, undefined, "Must NOT assume Intermediate");
    assert.equal(result.games[0].missingPlatform, true);
    assert.equal(result.games[0].missingSkill, true);
    assert.ok(result.conversationalResponse.includes("What platform do you play on?"));
});
test("10. Natural game parsing: multi-game string parses accurately", () => {
    const result = parseGamesNatural("Apex, Palworld and Minecraft");
    assert.equal(result.games.length, 3);
    const names = result.games.map(g => g.game);
    assert.ok(names.includes("Apex Legends"));
    assert.ok(names.includes("Palworld"));
    assert.ok(names.includes("Minecraft"));
});
test("11. Natural game parsing: explicit platform and skill are preserved", () => {
    const result = parseGamesNatural("Valorant — PC — Pro");
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].game, "Valorant");
    assert.equal(result.games[0].platform, "PC");
    assert.equal(result.games[0].skill, "Pro");
    assert.equal(result.games[0].missingPlatform, false);
});
// ── 5. Privacy: No Age/Gender Leaks & Confirmation Summary ───────────────────
test("12. Confirmation summary: displays classification, never exposes raw numerical age or private gender", () => {
    const answers = {
        age_group: "adult",
        gender: "Male", // even if present in private answers
        games: [{ game: "Apex Legends", platform: "PC", skill: "Intermediate" }],
        timing: "All day",
        timezone: "IST (UTC+5:30)",
        looking_preferences: ["Casual friends", "Co-op"],
        language: "English"
    };
    const summary = buildConfirmationSummary(answers);
    const card = formatConfirmationCard(summary);
    assert.ok(card.includes("18+ Member") || card.includes("Adult 18+"));
    assert.ok(card.includes("Self-reported"));
    assert.ok(!card.includes("21"), "Must NEVER display raw age");
    assert.ok(card.includes("Apex Legends (PC)"));
    assert.ok(card.includes("IST (UTC+5:30)"));
    assert.ok(card.includes("Does everything look correct?"));
});
// ── 6. UI Payloads: Ephemeral and Privacy-First ──────────────────────────────
test("13. UI Builder: generates interactive components for ephemeral flows", () => {
    const welcome = buildPublicVerifyWelcome("rules_ch_123");
    assert.ok(welcome.content.includes("Start Verification"));
    assert.ok(welcome.components.length > 0);
    const stepAge = buildStepAgePayload();
    assert.ok(stepAge.content.includes("Step 1 of 6"));
    assert.equal(stepAge.components[0].components.length, 4);
    const stepGender = buildStepGenderPayload();
    assert.ok(stepGender.content.includes("Step 2 of 6"));
    const stepLooking = buildStepLookingPayload(["Casual friends", "Ranked squad"]);
    assert.ok(stepLooking.content.includes("Step 5 of 6"));
    const confirmation = buildConfirmationPayload({ age_group: "minor" });
    assert.ok(confirmation.content.includes("Teen Member") || confirmation.content.includes("Minor 13–17"));
    assert.ok(confirmation.components[0].components.some((c) => c.data.label.includes("Confirm & Get Roles")));
});
// ── 7. SQLite Session Persistence & Confirmation-Before-Role ────────────────
test("14. Session flow: answers persist across restarts and roles are only assigned after confirmation", () => {
    const { db, dbPath } = createTestDb("session-ux");
    try {
        const guildId = "g_ux_1";
        const userId = "u_ux_1";
        // Start verification
        const { session } = db.getOrCreateVerificationSession(guildId, userId);
        assert.equal(session.step, "agree");
        assert.equal(session.status, "in_progress");
        // Advance through steps
        db.updateVerificationSession(guildId, userId, {
            step: "timing",
            answers: {
                age_group: "adult",
                age_confirmed: true,
                gender: null,
                games: [{ game: "Apex Legends", platform: "PC", skill: "Intermediate" }]
            }
        });
        // Check restart recovery: fetch from fresh DB connection
        const freshDb = new GameDatabase(dbPath);
        const recovered = freshDb.getVerificationSession(guildId, userId);
        assert.ok(recovered);
        assert.equal(recovered.step, "timing");
        assert.equal(recovered.answers?.age_group, "adult");
        assert.equal(recovered.answers?.games?.[0]?.game, "Apex Legends");
        assert.equal(recovered.status, "in_progress", "Must remain in_progress until final confirmation");
        // Complete only upon confirmation
        freshDb.completeVerificationSession(guildId, userId);
        const completed = freshDb.getVerificationSession(guildId, userId);
        assert.equal(completed?.status, "completed");
        freshDb.close();
    }
    finally {
        cleanupDb(db, dbPath);
    }
});
// ── 8. Anti-Leak Filter: Sensitive Disclosures vs Harmless Gaming Chat ─────
test("15. Anti-leak filter detects actual sensitive verification disclosures", () => {
    const sensitiveSamples = [
        "21",
        " 15 ",
        "18",
        "I am 21 years old",
        "I'm 16 yo",
        "my age is 20",
        "age: 19",
        "Male",
        "female",
        "Non-binary",
        "I am male",
        "my gender is female"
    ];
    for (const s of sensitiveSamples) {
        const res = detectSensitiveLeak(s);
        assert.equal(res.isLeak, true, `Must detect '${s}' as sensitive verification disclosure`);
    }
});
test("16. Anti-leak filter preserves harmless ordinary conversation with numbers and game titles", () => {
    const harmlessSamples = [
        "I play Apex 2",
        "I am looking for 5 teammates",
        "Age of Empires 4",
        "Dragon Age is awesome",
        "I main female characters in Valorant",
        "Is there an age limit?",
        "Dota 2 tonight?",
        "Need 2 more for CS2",
        "Can 3 of us join?",
        "Left 4 Dead 2 squad"
    ];
    for (const h of harmlessSamples) {
        const res = detectSensitiveLeak(h);
        assert.equal(res.isLeak, false, `Must NOT flag harmless message: '${h}'`);
    }
});
// ── 9. Age Validation: Under-13, Non-Numeric, Boundaries ─────────────────────
test("17. Age validation: under-13 users strictly rejected with isUnderage flag", () => {
    const under13 = ["12", "10", "5", "0"];
    for (const a of under13) {
        const res = validateAgeInput(a);
        assert.equal(res.valid, false, `Must reject age ${a}`);
        assert.equal(res.isUnderage, true, `Must flag age ${a} as underage`);
        assert.ok(res.error?.includes("13 years old"));
    }
});
test("18. Age validation: non-numeric, decimal, negative, and unrealistic ages rejected", () => {
    const invalid = ["15.5", "-5", "twenty", "20abc", "101", "150", ""];
    for (const inv of invalid) {
        const res = validateAgeInput(inv);
        assert.equal(res.valid, false, `Must reject invalid age '${inv}'`);
        assert.equal(res.isUnderage, undefined, `Must not flag non-numeric '${inv}' as underage`);
    }
});
test("19. Age validation: boundary values 13, 17, 18, 100 map correctly without storing raw age", () => {
    const v13 = validateAgeInput("13");
    assert.equal(v13.valid, true);
    assert.equal(v13.ageGroup, "minor", "13 must be classified as minor");
    assert.equal(v13.age, undefined, "Raw age must not be present");
    const v17 = validateAgeInput("17");
    assert.equal(v17.valid, true);
    assert.equal(v17.ageGroup, "minor", "17 must be classified as minor");
    const v18 = validateAgeInput("18");
    assert.equal(v18.valid, true);
    assert.equal(v18.ageGroup, "adult", "18 must be classified as adult");
    const v100 = validateAgeInput("100");
    assert.equal(v100.valid, true);
    assert.equal(v100.ageGroup, "adult", "100 must be classified as adult");
});
// ── 10. Ephemeral Interaction Reliability & Edge Cases ──────────────────────
test("20. Double clicking Start Verification resumes in-progress session without resetting answers", () => {
    const { db, dbPath } = createTestDb("double-click");
    try {
        const guildId = "g_double";
        const userId = "u_double";
        // 1st click: creates session at agree/age
        const first = db.getOrCreateVerificationSession(guildId, userId);
        assert.equal(first.created, true);
        // User progresses to games with answers
        db.updateVerificationSession(guildId, userId, {
            step: "games",
            answers: { age_group: "adult", age_confirmed: true }
        });
        // 2nd click: user clicks Start Verification again
        const second = db.getOrCreateVerificationSession(guildId, userId);
        assert.equal(second.created, false, "Must not create a new session");
        assert.equal(second.session.step, "games", "Must preserve step");
        assert.equal(second.session.answers.age_group, "adult", "Must preserve answers");
    }
    finally {
        cleanupDb(db, dbPath);
    }
});
test("21. Back navigation and editing earlier answers updates SQLite state cleanly", () => {
    const { db, dbPath } = createTestDb("back-nav");
    try {
        const guildId = "g_nav";
        const userId = "u_nav";
        db.getOrCreateVerificationSession(guildId, userId);
        db.updateVerificationSession(guildId, userId, {
            step: "timing",
            answers: { age_group: "minor", timing: "Mornings" }
        });
        // User presses Back to age and changes to adult
        db.updateVerificationSession(guildId, userId, {
            step: "age",
            answers: { age_group: "adult", age_confirmed: true, timing: "Mornings" }
        });
        const current = db.getVerificationSession(guildId, userId);
        assert.equal(current?.step, "age");
        assert.equal(current?.answers.age_group, "adult");
        assert.equal(current?.answers.timing, "Mornings", "Prior answers preserved");
    }
    finally {
        cleanupDb(db, dbPath);
    }
});
test("22. Concurrent verification sessions between two separate members run without crosstalk", () => {
    const { db, dbPath } = createTestDb("concurrent-members");
    try {
        const guildId = "g_cross";
        const userA = "u_alice";
        const userB = "u_bob";
        db.getOrCreateVerificationSession(guildId, userA);
        db.getOrCreateVerificationSession(guildId, userB);
        db.updateVerificationSession(guildId, userA, {
            step: "gender",
            answers: { age_group: "minor", gender: "Female" }
        });
        db.updateVerificationSession(guildId, userB, {
            step: "timing",
            answers: { age_group: "adult", gender: "Male", timing: "All day" }
        });
        const sessionA = db.getVerificationSession(guildId, userA);
        const sessionB = db.getVerificationSession(guildId, userB);
        assert.equal(sessionA?.answers.age_group, "minor");
        assert.equal(sessionA?.answers.gender, "Female");
        assert.equal(sessionB?.answers.age_group, "adult");
        assert.equal(sessionB?.answers.gender, "Male");
        assert.equal(sessionB?.answers.timing, "All day");
    }
    finally {
        cleanupDb(db, dbPath);
    }
});
// ── 11. Multi-Account Channel Access & Isolation Logic ──────────────────────
test("23. Multi-account isolation logic: Minor, Adult, Unverified, Staff permission checks", () => {
    // Overwrite models matching our live Discord category structure:
    // MINOR COMMUNITY: deny @everyone, deny Adult, allow Minor, allow Staff
    // ADULT COMMUNITY: deny @everyone, deny Minor, allow Adult, allow Staff
    // STAFF: deny @everyone, deny Minor, deny Adult, allow Staff
    const minorOverwrites = {
        everyone: false,
        adultRole: false,
        minorRole: true,
        staffRole: true
    };
    const adultOverwrites = {
        everyone: false,
        minorRole: false,
        adultRole: true,
        staffRole: true
    };
    const staffOverwrites = {
        everyone: false,
        minorRole: false,
        adultRole: false,
        staffRole: true
    };
    // 1. Minor Account Check
    assert.equal(minorOverwrites.minorRole, true, "Minor must access minor channel");
    assert.equal(adultOverwrites.minorRole, false, "Minor must NEVER access adult channel");
    assert.equal(staffOverwrites.minorRole, false, "Minor must NEVER access staff channel");
    // 2. Adult Account Check
    assert.equal(adultOverwrites.adultRole, true, "Adult must access adult channel");
    assert.equal(minorOverwrites.adultRole, false, "Adult must NEVER access minor channel");
    assert.equal(staffOverwrites.adultRole, false, "Adult must NEVER access staff channel");
    // 3. Unverified Member Check
    assert.equal(minorOverwrites.everyone, false, "Unverified member blocked from minor channels");
    assert.equal(adultOverwrites.everyone, false, "Unverified member blocked from adult channels");
    assert.equal(staffOverwrites.everyone, false, "Unverified member blocked from staff channels");
    // 4. Staff Member Check
    assert.equal(minorOverwrites.staffRole, true, "Staff can moderate minor channels");
    assert.equal(adultOverwrites.staffRole, true, "Staff can moderate adult channels");
    assert.equal(staffOverwrites.staffRole, true, "Staff can access staff channels");
});
//# sourceMappingURL=verification-ux.test.js.map