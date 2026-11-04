import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GameDatabase } from "../game-db.js";
import { buildProfileEmbed, buildProfileEditModal, buildProfilePreferencesRows } from "../profiles/profile-manager.js";
import { buildBadgesEmbed } from "../achievements/badge-manager.js";
import { buildRankEmbed, buildLeaderboardEmbed } from "../profiles/rank-manager.js";
const TEST_DB = path.resolve(process.cwd(), "data/test-member-profiles.db");
test.beforeEach(() => {
    if (fs.existsSync(TEST_DB))
        fs.unlinkSync(TEST_DB);
});
test.afterEach(() => {
    if (fs.existsSync(TEST_DB))
        fs.unlinkSync(TEST_DB);
});
test("1. Schema v2 initializes member_profiles and seeds default badges", () => {
    const db = new GameDatabase(TEST_DB);
    const badges = db.getAllBadges();
    assert.ok(badges.length >= 5, "Should have at least 5 default badges seeded");
    assert.ok(badges.some(b => b.slug === "verified_member"));
    assert.ok(badges.some(b => b.slug === "squad_pioneer"));
    assert.ok(badges.some(b => b.slug === "coop_veteran"));
    db.close();
});
test("2. Member profile CRUD operations persist preferences correctly", () => {
    const db = new GameDatabase(TEST_DB);
    const userId = "user_test_999";
    const initial = db.upsertMemberProfile({
        user_id: userId,
        bio: "Apex predator aiming for Masters.",
        primary_game: "Apex Legends",
        platform: "PC",
        playstyle: "Competitive",
        timing: "Evenings",
        timezone: "EST"
    });
    assert.equal(initial.user_id, userId);
    assert.equal(initial.bio, "Apex predator aiming for Masters.");
    assert.equal(initial.primary_game, "Apex Legends");
    assert.equal(initial.platform, "PC");
    assert.equal(initial.level, 1);
    assert.equal(initial.reputation, 0);
    // Update
    const updated = db.upsertMemberProfile({
        user_id: userId,
        platform: "PlayStation",
        reputation: 15
    });
    assert.equal(updated.platform, "PlayStation");
    assert.equal(updated.reputation, 15);
    assert.equal(updated.bio, "Apex predator aiming for Masters.", "Bio should be preserved");
    db.close();
});
test("3. Badge awarding and member badge queries", () => {
    const db = new GameDatabase(TEST_DB);
    const userId = "user_badge_123";
    assert.equal(db.getMemberBadges(userId).length, 0);
    const awarded = db.awardBadge(userId, "verified_member");
    assert.equal(awarded, true);
    const badges = db.getMemberBadges(userId);
    assert.equal(badges.length, 1);
    assert.equal(badges[0].slug, "verified_member");
    assert.equal(badges[0].emoji, "🛡️");
    // Duplicate award is idempotent
    const duplicate = db.awardBadge(userId, "verified_member");
    assert.equal(duplicate, false);
    assert.equal(db.getMemberBadges(userId).length, 1);
    db.close();
});
test("4. Progression: XP leveling formula and reputation tracking", () => {
    const db = new GameDatabase(TEST_DB);
    const userId = "user_xp_456";
    const rep1 = db.addReputation(userId, 5);
    assert.equal(rep1, 5);
    const res1 = db.addXp(userId, 50);
    assert.equal(res1.xp, 50);
    assert.equal(res1.level, 1);
    assert.equal(res1.leveledUp, false);
    // Level 2 requires >= 100 XP (floor(sqrt(100/100)) + 1 = 2)
    const res2 = db.addXp(userId, 60);
    assert.equal(res2.xp, 110);
    assert.equal(res2.level, 2);
    assert.equal(res2.leveledUp, true);
    db.close();
});
test("5. buildProfileEmbed outputs formatted Discord embed with zero privacy disclosure", () => {
    const mockUser = {
        id: "user_789",
        username: "ShadowOperative",
        displayAvatarURL: () => "https://cdn.discordapp.com/avatars/test.png"
    };
    const profile = {
        user_id: "user_789",
        bio: "Tactical team player",
        primary_game: "Valorant",
        platform: "PC",
        playstyle: "Competitive",
        timing: "Late Night",
        timezone: "UTC+5:30",
        reputation: 25,
        xp: 450,
        level: 3,
        created_at: Date.now(),
        updated_at: Date.now()
    };
    const badges = [
        { slug: "verified_member", name: "Verified Operative", description: "Verified", tier: "mythic", emoji: "🛡️" }
    ];
    const { embed, components } = buildProfileEmbed(mockUser, profile, badges, 2);
    // Assert Title & Author
    assert.ok(embed.data.title?.includes("ShadowOperative"));
    assert.equal(embed.data.color, 0x8A2BE2);
    // Assert Fields
    const fields = embed.data.fields || [];
    const combatField = fields.find(f => f.name.includes("Combat Preferences"));
    assert.ok(combatField?.value.includes("Valorant"));
    assert.ok(combatField?.value.includes("Competitive"));
    const badgeField = fields.find(f => f.name.includes("Honor Badges"));
    assert.ok(badgeField?.value.includes("Verified Operative"));
    // Privacy Firewall: Raw age and gender MUST NEVER be displayed
    const allJson = JSON.stringify(embed.toJSON());
    assert.ok(!allJson.includes("minor"), "Must not disclose minor/adult tag");
    assert.ok(!allJson.includes("gender"), "Must not disclose gender in profile embed");
    // Action components
    assert.equal(components.length, 1);
    assert.equal(components[0].components.length, 3);
});
test("6. buildProfileEditModal and buildProfilePreferencesRows create valid Discord interaction components", () => {
    const modal = buildProfileEditModal({ bio: "Hello", primary_game: "Apex" });
    assert.equal(modal.data.custom_id, "profile_edit_modal_submit");
    assert.equal(modal.components.length, 3);
    const rows = buildProfilePreferencesRows();
    assert.equal(rows.length, 3);
    assert.equal(rows[0].components[0].data.custom_id, "profile_platform_select");
    assert.equal(rows[1].components[0].data.custom_id, "profile_playstyle_select");
    assert.equal(rows[2].components[0].data.custom_id, "profile_timing_select");
});
test("7. buildBadgesEmbed, buildRankEmbed, and buildLeaderboardEmbed generate valid embeds", () => {
    const mockUser = {
        id: "user_test",
        username: "TestGamer",
        displayAvatarURL: () => "https://cdn.discordapp.com/avatars/test.png"
    };
    const badgesEmbed = buildBadgesEmbed(mockUser, [], [
        { slug: "verified_member", name: "Verified Operative", description: "Desc", tier: "mythic", emoji: "🛡️" }
    ]);
    assert.ok(badgesEmbed.embed.data.title?.includes("TestGamer"));
    const rankEmbed = buildRankEmbed(mockUser, {
        user_id: "user_test",
        bio: "",
        primary_game: "Apex Legends",
        platform: "PC",
        playstyle: "Casual",
        timing: "Evenings",
        timezone: "UTC",
        reputation: 10,
        xp: 250,
        level: 2,
        created_at: 0,
        updated_at: 0
    }, 1, 31);
    assert.ok(rankEmbed.embed.data.description?.includes("Level 2 Operative"));
    const leadEmbed = buildLeaderboardEmbed([
        {
            user_id: "user_test",
            bio: "",
            primary_game: "Apex",
            platform: "PC",
            playstyle: "Casual",
            timing: "",
            timezone: "",
            reputation: 50,
            xp: 1200,
            level: 4,
            created_at: 0,
            updated_at: 0,
            rank: 1
        }
    ], "user_test");
    assert.ok(leadEmbed.embed.data.description?.includes("user_test"));
});
//# sourceMappingURL=member-profiles.test.js.map