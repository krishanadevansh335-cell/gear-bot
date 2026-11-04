import test from "node:test";
import assert from "node:assert/strict";
import { BRAND_COLORS, BADGE_TIERS } from "../identity/design-tokens.js";
import { renderWelcomeCard, renderGoodbyeCard, renderProfileCard, renderGameCard, renderAnnouncementCard, renderEventCard, renderTournamentMatchCard, renderAchievementCard, renderLeaderboardCard, renderWeeklyMvpCard } from "../rendering/card-templates.js";
import { createCardAttachment, attachCardToEmbed, safeRenderCard } from "../rendering/discord-card-attachment.js";
import { EmbedBuilder } from "discord.js";
// Helper to check PNG magic numbers: 0x89 0x50 0x4E 0x47 (‰PNG)
function isPngBuffer(buf) {
    return buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}
// Helper to check GIF magic numbers: GIF87a or GIF89a
function isGifBuffer(buf) {
    return buf.length > 6 && buf.toString("ascii", 0, 3) === "GIF";
}
test("1. Design tokens contain required brand palettes and badge tiers", () => {
    assert.equal(BRAND_COLORS.primaryPurple, "#8A2BE2");
    assert.equal(BRAND_COLORS.secondaryCyan, "#00F0FF");
    assert.equal(BRAND_COLORS.backgroundObsidian, "#0B0E14");
    assert.ok(BADGE_TIERS.bronze);
    assert.ok(BADGE_TIERS.silver);
    assert.ok(BADGE_TIERS.gold);
    assert.ok(BADGE_TIERS.diamond);
    assert.ok(BADGE_TIERS.mythic);
});
test("2. renderWelcomeCard produces valid static PNG within Discord size boundaries", async () => {
    const buffer = await renderWelcomeCard({
        username: "ApexChampion",
        memberNumber: 42,
        isAnimated: false
    });
    assert.ok(buffer instanceof Buffer);
    assert.ok(buffer.length > 1000, "Buffer should have substantial graphical content");
    assert.ok(buffer.length < 1024 * 1024, "Buffer should be well under 1MB for Discord upload");
    assert.ok(isPngBuffer(buffer), "Must be a valid PNG buffer");
});
test("3. renderWelcomeCard produces valid animated GIF with scanlines", async () => {
    const buffer = await renderWelcomeCard({
        username: "CyberPilot",
        memberNumber: 108,
        isAnimated: true
    });
    assert.ok(buffer instanceof Buffer);
    assert.ok(buffer.length > 5000, "Animated GIF should have frame data");
    assert.ok(buffer.length < 2 * 1024 * 1024, "Animated GIF should be under 2MB for Discord embeds");
    assert.ok(isGifBuffer(buffer), "Must be a valid GIF buffer");
});
test("4. renderGoodbyeCard generates valid departure card buffer", async () => {
    const buffer = await renderGoodbyeCard({
        username: "GhostRecon",
        durationDays: 145
    });
    assert.ok(buffer instanceof Buffer);
    assert.ok(isPngBuffer(buffer));
    assert.ok(buffer.length > 1000);
});
test("5. renderProfileCard renders comprehensive gamer card with XP progress bar and badges", async () => {
    const buffer = await renderProfileCard({
        username: "ViperStriker",
        level: 24,
        xp: 3450,
        xpNext: 5000,
        rankTitle: "Apex Predator",
        primaryGame: "Apex Legends",
        platform: "PC",
        playstyle: "Competitive",
        reputation: 85,
        badges: [
            { tier: "mythic", label: "MYT" },
            { tier: "diamond", label: "DIA" },
            { tier: "gold", label: "GLD" }
        ]
    });
    assert.ok(buffer instanceof Buffer);
    assert.ok(isPngBuffer(buffer));
    assert.ok(buffer.length > 2000);
    assert.ok(buffer.length < 1.5 * 1024 * 1024);
});
test("6. renderGameCard produces gaming catalog card", async () => {
    const buffer = await renderGameCard({
        gameName: "Valorant",
        categoryName: "FPS & Competitive",
        memberCount: 38,
        activeVoiceChannels: 2,
        roleColor: "#FD4556",
        roleName: "Valorant Squad"
    });
    assert.ok(buffer instanceof Buffer);
    assert.ok(isPngBuffer(buffer));
});
test("7. renderAnnouncementCard and renderEventCard produce broadcast graphics", async () => {
    const annBuffer = await renderAnnouncementCard({
        title: "Season 4 Community Launch",
        subtitle: "New tournament brackets, dynamic voice lounges, and reputation rewards are now live.",
        categoryTag: "Major System Update",
        authorName: "Staff Command"
    });
    assert.ok(isPngBuffer(annBuffer));
    const evtBuffer = await renderEventCard({
        title: "Friday Night Warzone Scrims",
        gameName: "Call of Duty: Warzone",
        dateTimeStr: "Friday, 8:00 PM EST",
        hostName: "CaptainPrice",
        rewardStr: "5,000 Community XP + Gold Badge"
    });
    assert.ok(isPngBuffer(evtBuffer));
});
test("8. renderTournamentMatchCard produces esports showdown graphic", async () => {
    const buffer = await renderTournamentMatchCard({
        tournamentTitle: "Winter Championship 2026",
        roundName: "Semi-Finals // Match 4",
        teamAName: "Solar Flare",
        teamBName: "Shadow Clan",
        scoreA: 2,
        scoreB: 1,
        statusText: "GAME 3 IN PROGRESS"
    });
    assert.ok(buffer instanceof Buffer);
    assert.ok(isPngBuffer(buffer));
});
test("9. renderAchievementCard, renderLeaderboardCard, and renderWeeklyMvpCard produce valid visuals", async () => {
    const achBuffer = await renderAchievementCard({
        title: "Centurion Squad Leader",
        description: "Successfully host 100 matchmaking parties without a dispute.",
        tier: "diamond",
        xpReward: 2500
    });
    assert.ok(isPngBuffer(achBuffer));
    const leadBuffer = await renderLeaderboardCard({
        title: "Top Community Operatives",
        category: "Reputation & Activity",
        entries: [
            { rank: 1, username: "ViperStriker", level: 42, reputation: 1250 },
            { rank: 2, username: "ShadowBlade", level: 39, reputation: 980 },
            { rank: 3, username: "NovaKnight", level: 35, reputation: 850 },
            { rank: 4, username: "ZeroCool", level: 28, reputation: 620 },
            { rank: 5, username: "AeroAce", level: 25, reputation: 510 }
        ]
    });
    assert.ok(isPngBuffer(leadBuffer));
    const mvpBuffer = await renderWeeklyMvpCard({
        username: "ViperStriker",
        weekNumber: 44,
        year: 2026,
        votesCount: 67,
        achievementHighlight: "Clutched 1v3 finals in Winter Championship"
    });
    assert.ok(isPngBuffer(mvpBuffer));
});
test("10. Discord attachment helpers and error boundaries operate safely", async () => {
    const testBuffer = Buffer.from("test-png-payload");
    const attachment = createCardAttachment(testBuffer, "test-card.png");
    assert.equal(attachment.name, "test-card.png");
    const embed = new EmbedBuilder().setTitle("Test Embed");
    attachCardToEmbed(embed, "test-card.png");
    assert.equal(embed.data.image?.url, "attachment://test-card.png");
    // Error boundary catches error without crashing
    const failedResult = await safeRenderCard(async () => {
        throw new Error("Simulated canvas failure");
    }, {});
    assert.equal(failedResult, null);
});
//# sourceMappingURL=brand-rendering.test.js.map