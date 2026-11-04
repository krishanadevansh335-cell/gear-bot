export interface MemberProfile {
    user_id: string;
    bio: string;
    primary_game: string;
    platform: string;
    playstyle: string;
    timing: string;
    timezone: string;
    reputation: number;
    xp: number;
    level: number;
    created_at: number;
    updated_at: number;
}
export interface Badge {
    slug: string;
    name: string;
    description: string;
    tier: "bronze" | "silver" | "gold" | "diamond" | "mythic";
    emoji: string;
    awarded_at?: number;
}
export interface LfgParty {
    id: number;
    host_user_id: string;
    game_slug: string;
    game_name: string;
    platform: string;
    playstyle: string;
    activity: string;
    max_slots: number;
    status: "open" | "full" | "closed" | "cancelled";
    channel_id?: string | null;
    message_id?: string | null;
    voice_channel_id?: string | null;
    created_at: number;
    expires_at: number;
    members?: string[];
}
export interface Team {
    id: number;
    name: string;
    tag: string;
    captain_user_id: string;
    game_slug: string;
    created_at: number;
    members?: Array<{
        user_id: string;
        role: "captain" | "member" | "substitute";
        joined_at: number;
    }>;
}
export interface AutomationFeed {
    id: number;
    feed_type: "steam_deals" | "free_games" | "game_news" | "server_status" | "community_report" | string;
    external_id: string;
    title: string;
    content_json: string;
    posted_channel_id?: string | null;
    posted_message_id?: string | null;
    created_at: number;
}
export interface AutomationConfig {
    feed_type: string;
    enabled: boolean;
    channel_id: string;
    last_polled_at: number;
    poll_interval_minutes: number;
}
export interface VerificationSession {
    id?: number;
    guild_id: string;
    user_id: string;
    step: string;
    status: "in_progress" | "completed" | "review";
    review_reason?: string | null;
    answers: {
        age_group?: "minor" | "adult";
        age_confirmed?: boolean;
        gender?: string | null;
        games?: Array<{
            game: string;
            platform: string;
            skill: string;
        }>;
        timing?: string;
        looking?: string;
        language?: string | null;
    };
    reminded: boolean;
    created_at: number;
    updated_at: number;
    completed_at?: number | null;
}
export interface GameDefinition {
    id?: number;
    name: string;
    slug: string;
    category_id: string;
    role_name: string;
    role_color: string;
    text_channel_id?: string | null;
    voice_channel_id?: string | null;
    role_id?: string | null;
    member_count: number;
    created_at: number;
}
export interface GameRequest {
    id: number;
    game_name: string;
    category_id: string;
    requested_by_user_id: string;
    status: "pending" | "approved" | "rejected";
    moderator_id?: string | null;
    moderator_reason?: string | null;
    created_at: number;
    updated_at?: number | null;
}
export declare class GameDatabase {
    private db;
    constructor(dbPath?: string);
    private initTables;
    private runMigrations;
    /**
     * Applies schema migrations up to target version.
     */
    migrate(toVersion: number): void;
    /**
     * Safe rollback mechanism for schema versions.
     */
    rollback(toVersion: number): void;
    /**
     * Records member screening events with explicit state separation:
     * 1. Rules Screening (Discord native pending flag)
     * 2. Native Onboarding Status (Discord Community Onboarding is NOT observable via gateway)
     * 3. Custom AI Verification Status
     */
    recordScreeningEvent(userId: string, guildId: string, eventType: string, pendingBefore: boolean | null, pendingAfter: boolean | null, options?: {
        rulesScreeningComplete?: boolean;
        nativeOnboardingStatus?: string;
        customVerificationStatus?: string;
        customAnswers?: any;
        [key: string]: any;
    }): void;
    /**
     * Atomically gets or creates a verification session for guild + user.
     * If an active or completed session already exists, it is NOT overwritten,
     * guaranteeing that duplicate gateway events cannot reset progress.
     */
    getOrCreateVerificationSession(guildId: string, userId: string): {
        created: boolean;
        session: VerificationSession;
    };
    getVerificationSession(guildId: string, userId: string): VerificationSession | null;
    /**
     * Updates session step and/or answers atomically.
     */
    updateVerificationSession(guildId: string, userId: string, update: {
        step?: string;
        answers?: any;
        reminded?: boolean;
        status?: "in_progress" | "completed" | "review";
        review_reason?: string;
    }): VerificationSession | null;
    completeVerificationSession(guildId: string, userId: string): VerificationSession | null;
    setVerificationSessionReview(guildId: string, userId: string, reason: string): VerificationSession | null;
    getAllActiveVerificationSessions(guildId?: string): VerificationSession[];
    /**
     * Data minimization / retention policy:
     * Prunes completed sessions older than retentionDays.
     */
    pruneVerificationSessions(retentionDays?: number): number;
    getScreeningEventsForUser(userId: string): any[];
    seedCategoriesAndGames(catalogPath?: string): void;
    getAllGames(): GameDefinition[];
    getGamesByCategory(categoryId: string): GameDefinition[];
    getGameBySlug(slug: string): GameDefinition | null;
    addGame(game: {
        name: string;
        slug: string;
        category_id: string;
        role_name: string;
        role_color: string;
    }): GameDefinition;
    updateGameDiscordResources(slug: string, resources: {
        text_channel_id?: string | null;
        voice_channel_id?: string | null;
        role_id?: string | null;
    }): void;
    updateCategoryDiscordId(categoryId: string, discordCategoryId: string): void;
    getCategory(categoryId: string): any;
    getAllCategories(): any[];
    recordMemberGame(userId: string, gameSlug: string, platform: string, skill: string): void;
    createGameRequest(gameName: string, categoryId: string, userId: string): GameRequest;
    getPendingRequests(): GameRequest[];
    close(): void;
    resolveGameRequest(id: number, status: "approved" | "rejected", moderatorId: string, reason?: string): GameRequest | null;
    logAudit(action: string, details: string, operatorId?: string): void;
    getRecentAuditLogs(limit?: number): any[];
    getMemberProfile(userId: string): MemberProfile | null;
    upsertMemberProfile(data: Partial<MemberProfile> & {
        user_id: string;
    }): MemberProfile;
    getAllBadges(): Badge[];
    getMemberBadges(userId: string): Badge[];
    awardBadge(userId: string, badgeSlug: string): boolean;
    addReputation(userId: string, delta: number): number;
    addXp(userId: string, delta: number): {
        xp: number;
        level: number;
        leveledUp: boolean;
    };
    getLeaderboard(limit?: number): Array<MemberProfile & {
        rank: number;
    }>;
    createLfgParty(data: {
        host_user_id: string;
        game_slug: string;
        game_name: string;
        platform: string;
        playstyle: string;
        activity: string;
        max_slots?: number;
        durationMinutes?: number;
    }): {
        success: boolean;
        party?: LfgParty;
        error?: string;
    };
    getLfgParty(id: number): LfgParty | null;
    getActiveLfgParties(gameSlug?: string): LfgParty[];
    joinLfgParty(partyId: number, userId: string): {
        success: boolean;
        error?: string;
        party?: LfgParty;
    };
    leaveLfgParty(partyId: number, userId: string): {
        success: boolean;
        error?: string;
        party?: LfgParty;
    };
    closeLfgParty(partyId: number, hostUserId?: string): boolean;
    updateLfgPartyMessage(partyId: number, messageId: string): void;
    updateLfgPartyMessage(partyId: number, channelId: string, messageId: string, voiceChannelId?: string): void;
    createTeam(data: {
        name: string;
        tag: string;
        leader_user_id?: string;
        captain_user_id?: string;
        game_slug?: string;
        gameSlug?: string;
    }): {
        success: boolean;
        team?: Team;
        error?: string;
    };
    createTeam(name: string, tag: string, captainId: string, gameSlug: string): {
        success: boolean;
        team?: Team;
        error?: string;
    };
    getTeam(idOrTag: string | number): Team | null;
    getUserTeams(userId: string): Team[];
    addTeamMember(teamId: number, userId: string, role?: "member" | "substitute"): boolean;
    removeTeamMember(teamId: number, userId: string): boolean;
    recordAutomationFeed(feedType: string, externalId: string, title: string, contentJson: any, channelId?: string, messageId?: string): boolean;
    hasAutomationFeed(feedType: string, externalId: string): boolean;
    getRecentAutomationFeeds(feedType?: string, limit?: number): AutomationFeed[];
    getAutomationConfig(): AutomationConfig[];
    getAutomationConfig(feedType: string): AutomationConfig | null;
    updateAutomationPolled(feedType: string): void;
}
