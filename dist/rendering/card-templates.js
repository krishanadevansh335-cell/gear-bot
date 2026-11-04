import { createBaseCanvas, drawCyberpunkBackground, drawGlowText, drawAvatar, drawProgressBar, drawHexagon, drawBadge, encodeAnimatedGif } from "./card-renderer.js";
import { BRAND_COLORS, CARD_DIMENSIONS } from "../identity/design-tokens.js";
/**
 * 1. Renders the GAMING SHAMING Welcome Card.
 * Can output static PNG Buffer or 3-frame animated scanline/glitch GIF.
 */
export async function renderWelcomeCard(params) {
    const { width, height } = CARD_DIMENSIONS.welcome;
    const memberStr = params.memberNumber ? `#${String(params.memberNumber).padStart(4, "0")}` : "#0001";
    if (params.isAnimated) {
        const frames = [];
        const offsets = [0, 2, 4];
        for (let i = 0; i < 3; i++) {
            const canvas = createBaseCanvas(width, height);
            const ctx = canvas.getContext("2d");
            drawCyberpunkBackground(ctx, width, height, {
                scanlineOffset: offsets[i],
                glitchSlice: i === 1
            });
            // Header Tag
            drawGlowText(ctx, "SYSTEM RECOGNITION // VERIFIED ARRIVAL", 250, 65, {
                font: "bold 13px sans-serif",
                color: BRAND_COLORS.secondaryCyan,
                glowColor: BRAND_COLORS.secondaryCyanGlow,
                glowBlur: 6
            });
            // Main Title
            drawGlowText(ctx, "WELCOME TO GAMING SHAMING", 250, 115, {
                font: "900 28px sans-serif",
                color: BRAND_COLORS.textPrimary,
                glowColor: BRAND_COLORS.primaryPurple,
                glowBlur: 14
            });
            // Member handle
            drawGlowText(ctx, `@${params.username.toUpperCase()}`, 250, 165, {
                font: "bold 26px sans-serif",
                color: BRAND_COLORS.secondaryCyanBright,
                glowColor: BRAND_COLORS.secondaryCyanGlow,
                glowBlur: 10
            });
            // Join sequence chip
            drawHexagon(ctx, 275, 225, 20, BRAND_COLORS.primaryPurple, "#1B102F", 2);
            drawGlowText(ctx, `RECRUIT ${memberStr}`, 310, 230, {
                font: "bold 15px sans-serif",
                color: BRAND_COLORS.primaryPurpleBright,
                glowBlur: 4
            });
            // Footer brand mark
            drawGlowText(ctx, "POWERED BY GAMER GEAR ENGINE", width - 25, height - 25, {
                font: "bold 11px sans-serif",
                color: BRAND_COLORS.textMuted,
                align: "right"
            });
            // Avatar
            await drawAvatar(ctx, params.avatarUrl || null, 125, height / 2, 65, params.username);
            frames.push(canvas);
        }
        return encodeAnimatedGif(frames, width, height, 15);
    }
    // Static PNG render
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height);
    drawGlowText(ctx, "SYSTEM RECOGNITION // VERIFIED ARRIVAL", 250, 65, {
        font: "bold 13px sans-serif",
        color: BRAND_COLORS.secondaryCyan,
        glowColor: BRAND_COLORS.secondaryCyanGlow,
        glowBlur: 6
    });
    drawGlowText(ctx, "WELCOME TO GAMING SHAMING", 250, 115, {
        font: "900 28px sans-serif",
        color: BRAND_COLORS.textPrimary,
        glowColor: BRAND_COLORS.primaryPurple,
        glowBlur: 14
    });
    drawGlowText(ctx, `@${params.username.toUpperCase()}`, 250, 165, {
        font: "bold 26px sans-serif",
        color: BRAND_COLORS.secondaryCyanBright,
        glowColor: BRAND_COLORS.secondaryCyanGlow,
        glowBlur: 10
    });
    drawHexagon(ctx, 275, 225, 20, BRAND_COLORS.primaryPurple, "#1B102F", 2);
    drawGlowText(ctx, `RECRUIT ${memberStr}`, 310, 230, {
        font: "bold 15px sans-serif",
        color: BRAND_COLORS.primaryPurpleBright,
        glowBlur: 4
    });
    drawGlowText(ctx, "POWERED BY GAMER GEAR ENGINE", width - 25, height - 25, {
        font: "bold 11px sans-serif",
        color: BRAND_COLORS.textMuted,
        align: "right"
    });
    await drawAvatar(ctx, params.avatarUrl || null, 125, height / 2, 65, params.username);
    return canvas.toBuffer("image/png");
}
/**
 * 2. Renders the Goodbye Card for logging departed users.
 */
export async function renderGoodbyeCard(params) {
    const { width, height } = CARD_DIMENSIONS.goodbye;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height, {
        primaryAccent: BRAND_COLORS.accentCrimson,
        secondaryAccent: BRAND_COLORS.textMuted
    });
    drawGlowText(ctx, "TRANSMISSION TERMINATED // MEMBER DEPARTED", 210, 55, {
        font: "bold 12px sans-serif",
        color: BRAND_COLORS.accentCrimson,
        glowColor: "rgba(255, 51, 102, 0.4)",
        glowBlur: 6
    });
    drawGlowText(ctx, params.username, 210, 105, {
        font: "bold 26px sans-serif",
        color: BRAND_COLORS.textPrimary,
        glowBlur: 8
    });
    const tenureStr = params.durationDays ? `Served with honor for ${params.durationDays} days` : "Departed the battlefield";
    drawGlowText(ctx, tenureStr, 210, 145, {
        font: "14px sans-serif",
        color: BRAND_COLORS.textSecondary
    });
    drawGlowText(ctx, "GAMING SHAMING LOGS", width - 25, height - 20, {
        font: "bold 10px sans-serif",
        color: BRAND_COLORS.textMuted,
        align: "right"
    });
    await drawAvatar(ctx, params.avatarUrl || null, 105, height / 2, 50, params.username, {
        borderColor: BRAND_COLORS.accentCrimson,
        glowColor: "rgba(255, 51, 102, 0.4)"
    });
    return canvas.toBuffer("image/png");
}
/**
 * 3. Renders the Member Profile Card (/profile).
 */
export async function renderProfileCard(params) {
    const { width, height } = CARD_DIMENSIONS.profile;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height);
    // Avatar + Level Ring
    await drawAvatar(ctx, params.avatarUrl || null, 110, 110, 60, params.username);
    // Level Badge over Avatar
    drawHexagon(ctx, 160, 160, 22, BRAND_COLORS.primaryPurpleBright, "#200938", 2.5);
    drawGlowText(ctx, String(params.level), 160, 166, {
        font: "bold 15px sans-serif",
        color: BRAND_COLORS.textPrimary,
        align: "center"
    });
    // User Header info
    drawGlowText(ctx, params.username.toUpperCase(), 200, 75, {
        font: "900 28px sans-serif",
        color: BRAND_COLORS.textPrimary,
        glowColor: BRAND_COLORS.secondaryCyan,
        glowBlur: 10
    });
    const rankTitle = params.rankTitle || `Level ${params.level} Operative`;
    drawGlowText(ctx, rankTitle, 200, 105, {
        font: "bold 14px sans-serif",
        color: BRAND_COLORS.secondaryCyanBright
    });
    // XP Progress Bar
    const xpCurrent = params.xp;
    const xpNext = params.xpNext || 1000;
    const progress = Math.min(1, Math.max(0, xpCurrent / xpNext));
    drawProgressBar(ctx, 200, 125, 450, 14, progress);
    drawGlowText(ctx, `XP: ${xpCurrent.toLocaleString()} / ${xpNext.toLocaleString()}`, 200, 155, {
        font: "12px sans-serif",
        color: BRAND_COLORS.textSecondary
    });
    // Reputation Chip (Top Right)
    drawHexagon(ctx, width - 110, 75, 36, BRAND_COLORS.accentAmber, "#332204", 2.5);
    drawGlowText(ctx, "REP", width - 110, 68, {
        font: "bold 10px sans-serif",
        color: BRAND_COLORS.accentAmber,
        align: "center"
    });
    drawGlowText(ctx, `+${params.reputation}`, width - 110, 88, {
        font: "bold 16px sans-serif",
        color: BRAND_COLORS.textPrimary,
        align: "center"
    });
    // Divider
    ctx.strokeStyle = BRAND_COLORS.borderDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, 200);
    ctx.lineTo(width - 35, 200);
    ctx.stroke();
    // Stats Grid
    const colY = 245;
    // Primary Game
    drawGlowText(ctx, "FAVORITE GAME", 50, colY, { font: "bold 11px sans-serif", color: BRAND_COLORS.textMuted });
    drawGlowText(ctx, (params.primaryGame || "Apex Legends").slice(0, 18), 50, colY + 30, {
        font: "bold 18px sans-serif",
        color: BRAND_COLORS.textPrimary
    });
    // Platform
    drawGlowText(ctx, "PLATFORM", 300, colY, { font: "bold 11px sans-serif", color: BRAND_COLORS.textMuted });
    drawGlowText(ctx, (params.platform || "PC").slice(0, 12), 300, colY + 30, {
        font: "bold 18px sans-serif",
        color: BRAND_COLORS.secondaryCyanBright
    });
    // Playstyle
    drawGlowText(ctx, "PLAYSTYLE", 500, colY, { font: "bold 11px sans-serif", color: BRAND_COLORS.textMuted });
    drawGlowText(ctx, (params.playstyle || "Competitive").slice(0, 15), 500, colY + 30, {
        font: "bold 18px sans-serif",
        color: BRAND_COLORS.primaryPurpleBright
    });
    // Badges Section
    drawGlowText(ctx, "HONOR BADGES", 50, 345, { font: "bold 11px sans-serif", color: BRAND_COLORS.textMuted });
    const badges = params.badges && params.badges.length > 0 ? params.badges : [
        { tier: "mythic", label: "VER" },
        { tier: "gold", label: "EXP" },
        { tier: "diamond", label: "LFG" },
        { tier: "silver", label: "PRO" }
    ];
    badges.slice(0, 6).forEach((b, idx) => {
        drawBadge(ctx, 75 + idx * 70, 395, 24, b.tier, b.label);
    });
    // Footer Tag
    drawGlowText(ctx, "GAMER GEAR // DOSSIER #9243", width - 35, height - 25, {
        font: "bold 10px sans-serif",
        color: BRAND_COLORS.textMuted,
        align: "right"
    });
    return canvas.toBuffer("image/png");
}
/**
 * 4. Renders Game Directory Card (/games).
 */
export async function renderGameCard(params) {
    const { width, height } = CARD_DIMENSIONS.game;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const accent = params.roleColor || BRAND_COLORS.primaryPurpleBright;
    drawCyberpunkBackground(ctx, width, height, { primaryAccent: accent });
    // Category Tag
    drawGlowText(ctx, `DIRECTORY // ${params.categoryName.toUpperCase()}`, 45, 55, {
        font: "bold 12px sans-serif",
        color: BRAND_COLORS.secondaryCyan,
        glowColor: BRAND_COLORS.secondaryCyanGlow,
        glowBlur: 6
    });
    // Game Title
    drawGlowText(ctx, params.gameName.toUpperCase(), 45, 115, {
        font: "900 32px sans-serif",
        color: BRAND_COLORS.textPrimary,
        glowColor: accent,
        glowBlur: 14
    });
    // Assigned Role Tag
    if (params.roleName) {
        drawGlowText(ctx, `SQUAD ROLE: @${params.roleName}`, 45, 155, {
            font: "bold 14px sans-serif",
            color: accent
        });
    }
    // Stats Pods
    const podY = 220;
    // Active Players Pod
    drawHexagon(ctx, 90, podY + 30, 42, BRAND_COLORS.secondaryCyan, "#0A1C28", 2);
    drawGlowText(ctx, String(params.memberCount), 90, podY + 28, {
        font: "bold 22px sans-serif",
        color: BRAND_COLORS.textPrimary,
        align: "center"
    });
    drawGlowText(ctx, "PLAYERS", 90, podY + 46, {
        font: "bold 9px sans-serif",
        color: BRAND_COLORS.secondaryCyan,
        align: "center"
    });
    // Voice Lounge Pod
    const voiceCount = params.activeVoiceChannels || 1;
    drawHexagon(ctx, 220, podY + 30, 42, BRAND_COLORS.primaryPurple, "#1E0E33", 2);
    drawGlowText(ctx, String(voiceCount), 220, podY + 28, {
        font: "bold 22px sans-serif",
        color: BRAND_COLORS.textPrimary,
        align: "center"
    });
    drawGlowText(ctx, "LOUNGES", 220, podY + 46, {
        font: "bold 9px sans-serif",
        color: BRAND_COLORS.primaryPurpleBright,
        align: "center"
    });
    // Footer Call-to-action
    drawGlowText(ctx, "SELECT ROLE IN #CHOOSE-ROLES TO JOIN SQUAD", 45, height - 35, {
        font: "bold 12px sans-serif",
        color: BRAND_COLORS.textSecondary
    });
    return canvas.toBuffer("image/png");
}
/**
 * 5. Renders Announcement Card (#announcements).
 */
export async function renderAnnouncementCard(params) {
    const { width, height } = CARD_DIMENSIONS.announcement;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height, {
        primaryAccent: BRAND_COLORS.primaryPurpleBright,
        secondaryAccent: BRAND_COLORS.secondaryCyan
    });
    const tag = params.categoryTag || "COMMUNITY UPDATE";
    drawGlowText(ctx, `BROADCAST // ${tag.toUpperCase()}`, 50, 65, {
        font: "bold 13px sans-serif",
        color: BRAND_COLORS.secondaryCyan,
        glowColor: BRAND_COLORS.secondaryCyanGlow,
        glowBlur: 6
    });
    drawGlowText(ctx, params.title.toUpperCase(), 50, 135, {
        font: "900 34px sans-serif",
        color: BRAND_COLORS.textPrimary,
        glowColor: BRAND_COLORS.primaryPurple,
        glowBlur: 14
    });
    if (params.subtitle) {
        drawGlowText(ctx, params.subtitle, 50, 185, {
            font: "18px sans-serif",
            color: BRAND_COLORS.textSecondary
        });
    }
    // Footer
    drawGlowText(ctx, `AUTHOR: ${params.authorName || "STAFF TRANSMISSION"}`, 50, height - 35, {
        font: "bold 12px sans-serif",
        color: BRAND_COLORS.primaryPurpleBright
    });
    drawGlowText(ctx, "GAMING SHAMING OFFICIAL", width - 50, height - 35, {
        font: "bold 12px sans-serif",
        color: BRAND_COLORS.textMuted,
        align: "right"
    });
    return canvas.toBuffer("image/png");
}
/**
 * 6. Renders Event Card (#gaming-events).
 */
export async function renderEventCard(params) {
    const { width, height } = CARD_DIMENSIONS.event;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height, {
        primaryAccent: BRAND_COLORS.accentAmber
    });
    drawGlowText(ctx, `EVENT // ${params.gameName.toUpperCase()}`, 50, 65, {
        font: "bold 13px sans-serif",
        color: BRAND_COLORS.accentAmber,
        glowBlur: 6
    });
    drawGlowText(ctx, params.title.toUpperCase(), 50, 135, {
        font: "900 32px sans-serif",
        color: BRAND_COLORS.textPrimary,
        glowBlur: 12
    });
    drawGlowText(ctx, `SCHEDULE: ${params.dateTimeStr}`, 50, 185, {
        font: "bold 16px sans-serif",
        color: BRAND_COLORS.secondaryCyanBright
    });
    drawGlowText(ctx, `HOSTED BY: ${params.hostName}`, 50, 225, {
        font: "14px sans-serif",
        color: BRAND_COLORS.textSecondary
    });
    if (params.rewardStr) {
        drawGlowText(ctx, `PRIZE POOL: ${params.rewardStr}`, 50, 265, {
            font: "bold 16px sans-serif",
            color: BRAND_COLORS.accentAmber
        });
    }
    drawGlowText(ctx, "RSVP BELOW TO RESERVE SQUAD SLOT", 50, height - 35, {
        font: "bold 12px sans-serif",
        color: BRAND_COLORS.textMuted
    });
    return canvas.toBuffer("image/png");
}
/**
 * 7. Renders Tournament Match Showdown Card.
 */
export async function renderTournamentMatchCard(params) {
    const { width, height } = CARD_DIMENSIONS.tournamentMatch;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height);
    // Tournament & Round Title
    drawGlowText(ctx, `${params.tournamentTitle.toUpperCase()} // ${params.roundName.toUpperCase()}`, width / 2, 60, {
        font: "bold 14px sans-serif",
        color: BRAND_COLORS.secondaryCyan,
        align: "center",
        glowBlur: 6
    });
    // Team A (Left)
    drawGlowText(ctx, params.teamAName.toUpperCase().slice(0, 16), 180, 175, {
        font: "900 28px sans-serif",
        color: BRAND_COLORS.primaryPurpleBright,
        align: "center",
        glowBlur: 10
    });
    if (params.scoreA !== undefined) {
        drawGlowText(ctx, String(params.scoreA), 180, 230, {
            font: "bold 38px sans-serif",
            color: BRAND_COLORS.textPrimary,
            align: "center"
        });
    }
    // VS Shield (Center)
    drawHexagon(ctx, width / 2, 200, 48, BRAND_COLORS.accentCrimson, "#2E0A16", 3);
    drawGlowText(ctx, "VS", width / 2, 208, {
        font: "900 24px sans-serif",
        color: BRAND_COLORS.textPrimary,
        align: "center",
        glowBlur: 10
    });
    // Team B (Right)
    drawGlowText(ctx, params.teamBName.toUpperCase().slice(0, 16), width - 180, 175, {
        font: "900 28px sans-serif",
        color: BRAND_COLORS.secondaryCyanBright,
        align: "center",
        glowBlur: 10
    });
    if (params.scoreB !== undefined) {
        drawGlowText(ctx, String(params.scoreB), width - 180, 230, {
            font: "bold 38px sans-serif",
            color: BRAND_COLORS.textPrimary,
            align: "center"
        });
    }
    // Status text
    drawGlowText(ctx, params.statusText || "MATCH PENDING CONFIRMATION", width / 2, height - 40, {
        font: "bold 12px sans-serif",
        color: BRAND_COLORS.textMuted,
        align: "center"
    });
    return canvas.toBuffer("image/png");
}
/**
 * 8. Renders Achievement Unlock Card (/badges).
 */
export async function renderAchievementCard(params) {
    const { width, height } = CARD_DIMENSIONS.achievement;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height, {
        primaryAccent: BRAND_COLORS.accentAmber
    });
    // Hexagonal Badge Showcase
    drawBadge(ctx, 110, height / 2, 55, params.tier, params.tier.slice(0, 3));
    // Achievement Info
    drawGlowText(ctx, `ACHIEVEMENT UNLOCKED // ${params.tier.toUpperCase()} TIER`, 210, 85, {
        font: "bold 12px sans-serif",
        color: BRAND_COLORS.accentAmber,
        glowBlur: 6
    });
    drawGlowText(ctx, params.title.toUpperCase(), 210, 135, {
        font: "900 26px sans-serif",
        color: BRAND_COLORS.textPrimary,
        glowBlur: 10
    });
    drawGlowText(ctx, params.description, 210, 175, {
        font: "14px sans-serif",
        color: BRAND_COLORS.textSecondary
    });
    // XP Reward
    drawGlowText(ctx, `REWARD: +${params.xpReward} XP`, 210, 225, {
        font: "bold 16px sans-serif",
        color: BRAND_COLORS.secondaryCyanBright
    });
    return canvas.toBuffer("image/png");
}
/**
 * 9. Renders Leaderboard Ranking Card (/leaderboard).
 */
export async function renderLeaderboardCard(params) {
    const { width, height } = CARD_DIMENSIONS.leaderboard;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height);
    drawGlowText(ctx, `COMMUNITY LEADERBOARD // ${params.category.toUpperCase()}`, 50, 55, {
        font: "bold 13px sans-serif",
        color: BRAND_COLORS.secondaryCyan,
        glowBlur: 6
    });
    drawGlowText(ctx, params.title.toUpperCase(), 50, 105, {
        font: "900 30px sans-serif",
        color: BRAND_COLORS.textPrimary,
        glowColor: BRAND_COLORS.primaryPurple,
        glowBlur: 12
    });
    // Top entries
    const startY = 160;
    const rowHeight = 65;
    params.entries.slice(0, 5).forEach((entry, idx) => {
        const y = startY + idx * rowHeight;
        const isTop3 = entry.rank <= 3;
        const rankColor = entry.rank === 1 ? "#FBBF24" : entry.rank === 2 ? "#E2E8F0" : entry.rank === 3 ? "#CD7F32" : BRAND_COLORS.textSecondary;
        // Row backplate
        ctx.fillStyle = idx % 2 === 0 ? "rgba(22, 27, 34, 0.7)" : "rgba(16, 20, 29, 0.7)";
        ctx.beginPath();
        ctx.roundRect(45, y - 25, width - 90, 52, 6);
        ctx.fill();
        // Rank Medal / Number
        drawHexagon(ctx, 80, y, 18, rankColor, "#10141D", 2);
        drawGlowText(ctx, `#${entry.rank}`, 80, y + 5, {
            font: "bold 13px sans-serif",
            color: rankColor,
            align: "center"
        });
        // Username
        drawGlowText(ctx, entry.username, 125, y + 5, {
            font: isTop3 ? "bold 18px sans-serif" : "16px sans-serif",
            color: isTop3 ? BRAND_COLORS.textPrimary : BRAND_COLORS.textSecondary
        });
        // Level
        drawGlowText(ctx, `LVL ${entry.level}`, width - 240, y + 5, {
            font: "bold 14px sans-serif",
            color: BRAND_COLORS.primaryPurpleBright
        });
        // Rep
        drawGlowText(ctx, `+${entry.reputation} REP`, width - 90, y + 5, {
            font: "bold 14px sans-serif",
            color: BRAND_COLORS.accentAmber,
            align: "right"
        });
    });
    return canvas.toBuffer("image/png");
}
/**
 * 10. Renders Weekly MVP Highlight Card.
 */
export async function renderWeeklyMvpCard(params) {
    const { width, height } = CARD_DIMENSIONS.mvp;
    const canvas = createBaseCanvas(width, height);
    const ctx = canvas.getContext("2d");
    drawCyberpunkBackground(ctx, width, height, {
        primaryAccent: BRAND_COLORS.accentAmber,
        secondaryAccent: BRAND_COLORS.primaryPurpleBright
    });
    // Crown Header
    drawGlowText(ctx, `WEEKLY MVP // WEEK ${params.weekNumber}, ${params.year}`, width / 2, 60, {
        font: "bold 14px sans-serif",
        color: BRAND_COLORS.accentAmber,
        align: "center",
        glowBlur: 8
    });
    // Avatar in Center
    await drawAvatar(ctx, params.avatarUrl || null, width / 2, 160, 55, params.username, {
        borderColor: BRAND_COLORS.accentAmber,
        glowColor: "rgba(251, 191, 36, 0.5)"
    });
    // Username
    drawGlowText(ctx, params.username.toUpperCase(), width / 2, 255, {
        font: "900 28px sans-serif",
        color: BRAND_COLORS.textPrimary,
        align: "center",
        glowColor: BRAND_COLORS.accentAmber,
        glowBlur: 10
    });
    // Highlight Text
    drawGlowText(ctx, params.achievementHighlight, width / 2, 295, {
        font: "15px sans-serif",
        color: BRAND_COLORS.textSecondary,
        align: "center"
    });
    // Votes Banner
    drawGlowText(ctx, `ELECTED BY COMMUNITY WITH ${params.votesCount} VOTES`, width / 2, 345, {
        font: "bold 14px sans-serif",
        color: BRAND_COLORS.secondaryCyanBright,
        align: "center",
        glowBlur: 6
    });
    return canvas.toBuffer("image/png");
}
//# sourceMappingURL=card-templates.js.map