import { BadgeTier } from "../identity/design-tokens.js";
export interface WelcomeCardParams {
    username: string;
    avatarUrl?: string | null;
    memberNumber?: number;
    isAnimated?: boolean;
}
export interface GoodbyeCardParams {
    username: string;
    avatarUrl?: string | null;
    durationDays?: number;
}
export interface ProfileCardParams {
    username: string;
    tag?: string;
    avatarUrl?: string | null;
    level: number;
    xp: number;
    xpNext: number;
    rankTitle?: string;
    primaryGame?: string;
    platform?: string;
    playstyle?: string;
    reputation: number;
    badges?: Array<{
        tier: BadgeTier;
        label: string;
    }>;
}
export interface GameCardParams {
    gameName: string;
    categoryName: string;
    memberCount: number;
    activeVoiceChannels?: number;
    roleColor?: string;
    roleName?: string;
}
export interface AnnouncementCardParams {
    title: string;
    subtitle?: string;
    categoryTag?: string;
    authorName?: string;
}
export interface EventCardParams {
    title: string;
    gameName: string;
    dateTimeStr: string;
    hostName: string;
    rewardStr?: string;
}
export interface TournamentMatchCardParams {
    tournamentTitle: string;
    roundName: string;
    teamAName: string;
    teamBName: string;
    scoreA?: number;
    scoreB?: number;
    statusText?: string;
}
export interface AchievementCardParams {
    title: string;
    description: string;
    tier: BadgeTier;
    xpReward: number;
}
export interface LeaderboardEntry {
    rank: number;
    username: string;
    level: number;
    reputation: number;
}
export interface LeaderboardCardParams {
    title: string;
    category: string;
    entries: LeaderboardEntry[];
}
export interface WeeklyMvpCardParams {
    username: string;
    avatarUrl?: string | null;
    weekNumber: number;
    year: number;
    votesCount: number;
    achievementHighlight: string;
}
/**
 * 1. Renders the GAMING SHAMING Welcome Card.
 * Can output static PNG Buffer or 3-frame animated scanline/glitch GIF.
 */
export declare function renderWelcomeCard(params: WelcomeCardParams): Promise<Buffer>;
/**
 * 2. Renders the Goodbye Card for logging departed users.
 */
export declare function renderGoodbyeCard(params: GoodbyeCardParams): Promise<Buffer>;
/**
 * 3. Renders the Member Profile Card (/profile).
 */
export declare function renderProfileCard(params: ProfileCardParams): Promise<Buffer>;
/**
 * 4. Renders Game Directory Card (/games).
 */
export declare function renderGameCard(params: GameCardParams): Promise<Buffer>;
/**
 * 5. Renders Announcement Card (#announcements).
 */
export declare function renderAnnouncementCard(params: AnnouncementCardParams): Promise<Buffer>;
/**
 * 6. Renders Event Card (#gaming-events).
 */
export declare function renderEventCard(params: EventCardParams): Promise<Buffer>;
/**
 * 7. Renders Tournament Match Showdown Card.
 */
export declare function renderTournamentMatchCard(params: TournamentMatchCardParams): Promise<Buffer>;
/**
 * 8. Renders Achievement Unlock Card (/badges).
 */
export declare function renderAchievementCard(params: AchievementCardParams): Promise<Buffer>;
/**
 * 9. Renders Leaderboard Ranking Card (/leaderboard).
 */
export declare function renderLeaderboardCard(params: LeaderboardCardParams): Promise<Buffer>;
/**
 * 10. Renders Weekly MVP Highlight Card.
 */
export declare function renderWeeklyMvpCard(params: WeeklyMvpCardParams): Promise<Buffer>;
