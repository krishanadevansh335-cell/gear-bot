import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GameDatabase } from "../game-db.js";
import { buildLfgPartyEmbed } from "../matchmaking/lfg-manager.js";
import { buildTeamEmbed } from "../teams/team-manager.js";
import { buildSteamDealEmbed, buildFreeGameEmbed } from "../automation/feed-manager.js";
const TEST_DB = path.resolve(process.cwd(), "data/test-lfg-automation.db");
test.beforeEach(() => {
    if (fs.existsSync(TEST_DB))
        fs.unlinkSync(TEST_DB);
});
test.afterEach(() => {
    if (fs.existsSync(TEST_DB))
        fs.unlinkSync(TEST_DB);
});
test("1. Schema v3 initializes LFG, Teams, and Automation tables with default configs", () => {
    const db = new GameDatabase(TEST_DB);
    const steamCfg = db.getAutomationConfig("steam_deals");
    assert.ok(steamCfg, "Steam deals config should exist");
    assert.equal(steamCfg.enabled, true);
    const freeCfg = db.getAutomationConfig("free_games");
    assert.ok(freeCfg, "Free games config should exist");
    const reportCfg = db.getAutomationConfig("community_report");
    assert.ok(reportCfg, "Weekly report config should exist");
    db.close();
});
test("2. LFG Party Lifecycle: Creation, Member Joining, Overfill Protection, and Expiry", () => {
    const db = new GameDatabase(TEST_DB);
    const hostId = "user_host_1";
    const member2 = "user_member_2";
    const member3 = "user_member_3";
    // Create Party
    const res = db.createLfgParty({
        host_user_id: hostId,
        game_slug: "lethal-company",
        game_name: "Lethal Company",
        platform: "PC",
        playstyle: "Co-op / Scavenger",
        activity: "Quota 3 Scrims",
        max_slots: 2,
        durationMinutes: 60
    });
    assert.equal(res.success, true);
    assert.ok(res.party);
    assert.equal(res.party.max_slots, 2);
    assert.equal(res.party.status, "open");
    assert.deepEqual(res.party.members, [hostId]);
    // Prevent duplicate active party from same host
    const dup = db.createLfgParty({
        host_user_id: hostId,
        game_slug: "apex-legends",
        game_name: "Apex Legends",
        platform: "PC",
        playstyle: "Competitive",
        activity: "Ranked"
    });
    assert.equal(dup.success, false);
    assert.ok(dup.error?.includes("already have an active LFG party"));
    // Member 2 joins -> Party becomes FULL
    const join1 = db.joinLfgParty(res.party.id, member2);
    assert.equal(join1.success, true);
    assert.equal(join1.party?.status, "full");
    assert.equal(join1.party?.members?.length, 2);
    // Member 3 tries to join full party -> Rejected
    const join2 = db.joinLfgParty(res.party.id, member3);
    assert.equal(join2.success, false);
    assert.ok(join2.error?.includes("full"));
    // Member 2 leaves -> Party reopens to OPEN
    const leave1 = db.leaveLfgParty(res.party.id, member2);
    assert.equal(leave1.success, true);
    assert.equal(leave1.party?.status, "open");
    assert.deepEqual(leave1.party?.members, [hostId]);
    // Host leaves -> Party cancelled
    const hostLeave = db.leaveLfgParty(res.party.id, hostId);
    assert.equal(hostLeave.success, true);
    assert.equal(hostLeave.party?.status, "cancelled");
    db.close();
});
test("3. Team / Clan Management: Creation, Tag Normalization, and Roster", () => {
    const db = new GameDatabase(TEST_DB);
    const captainId = "user_captain_1";
    const memberId = "user_member_2";
    // Create Team
    const res = db.createTeam("Shadow Operatives", "shm!", captainId, "apex-legends");
    assert.equal(res.success, true);
    assert.ok(res.team);
    assert.equal(res.team.tag, "SHM", "Tag should be uppercase alphanumeric");
    assert.equal(res.team.captain_user_id, captainId);
    // Prevent Duplicate Tag or Name
    const dup = db.createTeam("Shadow Operatives Two", "SHM", "user_other", "valorant");
    assert.equal(dup.success, false);
    assert.ok(dup.error?.includes("already exists"));
    // Add Member
    const added = db.addTeamMember(res.team.id, memberId, "member");
    assert.equal(added, true);
    const team = db.getTeam("SHM");
    assert.ok(team);
    assert.equal(team.members?.length, 2);
    // User Teams query
    const userTeams = db.getUserTeams(memberId);
    assert.equal(userTeams.length, 1);
    assert.equal(userTeams[0].tag, "SHM");
    db.close();
});
test("4. Phase 6 Automation: Deduplication and Feed Tracking", () => {
    const db = new GameDatabase(TEST_DB);
    const feedType = "steam_deals";
    const externalId = "steam_app_1966720";
    const title = "Lethal Company 30% Off";
    assert.equal(db.hasAutomationFeed(feedType, externalId), false);
    // First record -> true
    const first = db.recordAutomationFeed(feedType, externalId, title, { discount: 30 }, "ch_123", "msg_456");
    assert.equal(first, true);
    assert.equal(db.hasAutomationFeed(feedType, externalId), true);
    // Duplicate record -> false (strictly prevented)
    const second = db.recordAutomationFeed(feedType, externalId, title, { discount: 30 }, "ch_123", "msg_789");
    assert.equal(second, false);
    // Query recent
    const recent = db.getRecentAutomationFeeds(feedType, 5);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].title, title);
    db.close();
});
test("5. LFG and Automation Embed Builders output compliant visual components", () => {
    const mockParty = {
        id: 42,
        host_user_id: "user_host_123",
        game_slug: "lethal-company",
        game_name: "Lethal Company",
        platform: "PC",
        playstyle: "Co-op Horror",
        activity: "Titan Moon Scrap Runs",
        max_slots: 4,
        status: "open",
        created_at: Date.now(),
        expires_at: Date.now() + 3600000,
        members: ["user_host_123", "user_mem_2"]
    };
    const { embed, components } = buildLfgPartyEmbed(mockParty);
    assert.ok(embed.data.title?.includes("LETHAL COMPANY"));
    assert.equal(embed.data.color, 0x10B981); // Open emerald color
    assert.equal(components.length, 1);
    assert.equal(components[0].components.length, 4);
    // Steam Deal Embed
    const dealEmbed = buildSteamDealEmbed({
        id: "app_123",
        title: "Phasmophobia",
        discountPercent: 25,
        originalPrice: "$13.99",
        salePrice: "$10.49",
        storeUrl: "https://store.steampowered.com/app/739630/Phasmophobia/",
        expiryStr: "Thursday 10:00 AM PST"
    });
    assert.ok(dealEmbed.embed.data.title?.includes("PHASMOPHOBIA"));
    assert.ok(dealEmbed.embed.data.description?.includes("-25% OFF"));
    // Free Game Embed
    const freeEmbed = buildFreeGameEmbed({
        id: "free_1",
        title: "Deep Rock Galactic",
        platform: "Steam",
        storeUrl: "https://store.steampowered.com/app/548430/Deep_Rock_Galactic/",
        expiryStr: "Sunday",
        description: "Free weekend test"
    });
    assert.ok(freeEmbed.embed.data.title?.includes("100% FREE"));
    // Team Embed
    const teamEmbed = buildTeamEmbed({
        id: 1,
        name: "Apex Predators",
        tag: "APX",
        captain_user_id: "user_cap",
        game_slug: "apex-legends",
        created_at: Date.now(),
        members: [{ user_id: "user_cap", role: "captain", joined_at: Date.now() }]
    });
    assert.ok(teamEmbed.embed.data.title?.includes("[APX]"));
});
//# sourceMappingURL=matchmaking-and-automation.test.js.map