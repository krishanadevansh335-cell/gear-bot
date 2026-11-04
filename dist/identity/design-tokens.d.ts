/**
 * GAMING SHAMING & Gamer Gear Design System Tokens
 * Unified visual language for esports cards, embeds, and dynamic UI assets.
 */
export declare const BRAND_COLORS: {
    readonly backgroundObsidian: "#0B0E14";
    readonly backgroundSurface: "#141923";
    readonly backgroundElevated: "#1A2230";
    readonly backgroundOverlay: "rgba(11, 14, 20, 0.85)";
    readonly primaryPurple: "#8A2BE2";
    readonly primaryPurpleGlow: "rgba(138, 43, 226, 0.45)";
    readonly primaryPurpleBright: "#A855F7";
    readonly primaryPurpleMuted: "#4C1D95";
    readonly secondaryCyan: "#00F0FF";
    readonly secondaryCyanGlow: "rgba(0, 240, 255, 0.45)";
    readonly secondaryCyanBright: "#38BDF8";
    readonly secondaryCyanMuted: "#0284C7";
    readonly accentCrimson: "#FF3366";
    readonly accentAmber: "#FFB703";
    readonly accentEmerald: "#10B981";
    readonly textPrimary: "#FFFFFF";
    readonly textSecondary: "#94A3B8";
    readonly textMuted: "#64748B";
    readonly textDark: "#334155";
    readonly borderDark: "#262D3D";
    readonly borderPurple: "rgba(138, 43, 226, 0.4)";
    readonly borderCyan: "rgba(0, 240, 255, 0.4)";
};
export declare const BADGE_TIERS: {
    readonly bronze: {
        readonly name: "Bronze";
        readonly color: "#CD7F32";
        readonly glow: "rgba(205, 127, 50, 0.5)";
        readonly bg: "#2A1808";
    };
    readonly silver: {
        readonly name: "Silver";
        readonly color: "#E2E8F0";
        readonly glow: "rgba(226, 232, 240, 0.5)";
        readonly bg: "#1E293B";
    };
    readonly gold: {
        readonly name: "Gold";
        readonly color: "#FBBF24";
        readonly glow: "rgba(251, 191, 36, 0.5)";
        readonly bg: "#3B2503";
    };
    readonly diamond: {
        readonly name: "Diamond";
        readonly color: "#38BDF8";
        readonly glow: "rgba(56, 189, 248, 0.5)";
        readonly bg: "#082F49";
    };
    readonly mythic: {
        readonly name: "Mythic";
        readonly color: "#A855F7";
        readonly glow: "rgba(168, 85, 247, 0.6)";
        readonly bg: "#3B0764";
    };
};
export type BadgeTier = keyof typeof BADGE_TIERS;
export declare const CARD_DIMENSIONS: {
    readonly welcome: {
        readonly width: 800;
        readonly height: 360;
    };
    readonly goodbye: {
        readonly width: 800;
        readonly height: 260;
    };
    readonly profile: {
        readonly width: 900;
        readonly height: 480;
    };
    readonly game: {
        readonly width: 800;
        readonly height: 380;
    };
    readonly announcement: {
        readonly width: 900;
        readonly height: 420;
    };
    readonly event: {
        readonly width: 900;
        readonly height: 440;
    };
    readonly tournamentMatch: {
        readonly width: 900;
        readonly height: 450;
    };
    readonly achievement: {
        readonly width: 700;
        readonly height: 320;
    };
    readonly leaderboard: {
        readonly width: 900;
        readonly height: 520;
    };
    readonly mvp: {
        readonly width: 800;
        readonly height: 450;
    };
};
export declare const BRAND_FONTS: {
    readonly header: "sans-serif";
    readonly body: "sans-serif";
    readonly mono: "monospace";
};
