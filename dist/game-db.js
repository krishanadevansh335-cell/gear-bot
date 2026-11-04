import { DatabaseSync } from "node:sqlite";
import * as path from "path";
import * as fs from "fs";
export class GameDatabase {
    db;
    constructor(dbPath) {
        const resolvedPath = dbPath || path.resolve(process.cwd(), "data/gaming-system.db");
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new DatabaseSync(resolvedPath);
        this.initTables();
    }
    initTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        max_channels INTEGER NOT NULL DEFAULT 20,
        discord_category_id TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        category_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        role_color TEXT NOT NULL,
        text_channel_id TEXT,
        voice_channel_id TEXT,
        role_id TEXT,
        member_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (category_id) REFERENCES game_categories(id)
      );

      CREATE TABLE IF NOT EXISTS member_game_profiles (
        user_id TEXT NOT NULL,
        game_slug TEXT NOT NULL,
        platform TEXT NOT NULL,
        skill TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, game_slug)
      );

      CREATE TABLE IF NOT EXISTS game_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_name TEXT NOT NULL,
        category_id TEXT NOT NULL,
        requested_by_user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        moderator_id TEXT,
        moderator_reason TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        operator_id TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schema_versions (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL,
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS member_screening_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        pending_before INTEGER,
        pending_after INTEGER,
        rules_screening_complete INTEGER NOT NULL DEFAULT 0,
        native_onboarding_status TEXT NOT NULL DEFAULT 'unknown_not_observable',
        custom_verification_status TEXT NOT NULL DEFAULT 'not_started',
        custom_answers TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS verification_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        step TEXT NOT NULL DEFAULT 'agree',
        status TEXT NOT NULL DEFAULT 'in_progress',
        review_reason TEXT,
        answers_json TEXT NOT NULL DEFAULT '{}',
        reminded INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        UNIQUE(guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS member_profiles (
        user_id TEXT PRIMARY KEY,
        bio TEXT NOT NULL DEFAULT '',
        primary_game TEXT NOT NULL DEFAULT 'Apex Legends',
        platform TEXT NOT NULL DEFAULT 'PC',
        playstyle TEXT NOT NULL DEFAULT 'Casual',
        timing TEXT NOT NULL DEFAULT 'Evenings',
        timezone TEXT NOT NULL DEFAULT 'UTC',
        reputation INTEGER NOT NULL DEFAULT 0,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS badges (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        tier TEXT NOT NULL CHECK(tier IN ('bronze', 'silver', 'gold', 'diamond', 'mythic')),
        emoji TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS member_badges (
        user_id TEXT NOT NULL,
        badge_slug TEXT NOT NULL,
        awarded_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, badge_slug),
        FOREIGN KEY (badge_slug) REFERENCES badges(slug)
      );

      CREATE TABLE IF NOT EXISTS lfg_parties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_user_id TEXT NOT NULL,
        game_slug TEXT NOT NULL,
        game_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        playstyle TEXT NOT NULL,
        activity TEXT NOT NULL,
        max_slots INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'open',
        channel_id TEXT,
        message_id TEXT,
        voice_channel_id TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lfg_party_members (
        party_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (party_id, user_id),
        FOREIGN KEY (party_id) REFERENCES lfg_parties(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        tag TEXT NOT NULL UNIQUE,
        captain_user_id TEXT NOT NULL,
        game_slug TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS team_members (
        team_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (team_id, user_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS automation_feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_type TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content_json TEXT NOT NULL,
        posted_channel_id TEXT,
        posted_message_id TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(feed_type, external_id)
      );

      CREATE TABLE IF NOT EXISTS automation_config (
        feed_type TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        channel_id TEXT NOT NULL,
        last_polled_at INTEGER NOT NULL DEFAULT 0,
        poll_interval_minutes INTEGER NOT NULL DEFAULT 60
      );
    `);
        this.runMigrations();
    }
    runMigrations() {
        try {
            // Check if schema_versions has version 1
            const checkVer1 = this.db.prepare("SELECT * FROM schema_versions WHERE version = 1");
            const ver1 = checkVer1.all();
            if (ver1.length === 0) {
                // Ensure columns exist on member_screening_events
                const tableInfo = this.db.prepare("PRAGMA table_info(member_screening_events)").all();
                const colNames = tableInfo.map(c => c.name);
                if (!colNames.includes("rules_screening_complete")) {
                    this.db.exec("ALTER TABLE member_screening_events ADD COLUMN rules_screening_complete INTEGER NOT NULL DEFAULT 0;");
                }
                if (!colNames.includes("native_onboarding_status")) {
                    this.db.exec("ALTER TABLE member_screening_events ADD COLUMN native_onboarding_status TEXT NOT NULL DEFAULT 'unknown_not_observable';");
                }
                if (!colNames.includes("custom_verification_status")) {
                    this.db.exec("ALTER TABLE member_screening_events ADD COLUMN custom_verification_status TEXT NOT NULL DEFAULT 'not_started';");
                }
                const insertVer = this.db.prepare("INSERT INTO schema_versions (version, applied_at, description) VALUES (1, ?, 'Initial v1 schema with separated screening states and persistent sessions')");
                insertVer.run(Date.now());
            }
            // Check if schema_versions has version 2
            const checkVer2 = this.db.prepare("SELECT * FROM schema_versions WHERE version = 2");
            const ver2 = checkVer2.all();
            if (ver2.length === 0) {
                this.db.exec(`
          CREATE TABLE IF NOT EXISTS member_profiles (
            user_id TEXT PRIMARY KEY,
            bio TEXT NOT NULL DEFAULT '',
            primary_game TEXT NOT NULL DEFAULT 'Apex Legends',
            platform TEXT NOT NULL DEFAULT 'PC',
            playstyle TEXT NOT NULL DEFAULT 'Casual',
            timing TEXT NOT NULL DEFAULT 'Evenings',
            timezone TEXT NOT NULL DEFAULT 'UTC',
            reputation INTEGER NOT NULL DEFAULT 0,
            xp INTEGER NOT NULL DEFAULT 0,
            level INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );

          CREATE TABLE IF NOT EXISTS badges (
            slug TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            tier TEXT NOT NULL CHECK(tier IN ('bronze', 'silver', 'gold', 'diamond', 'mythic')),
            emoji TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS member_badges (
            user_id TEXT NOT NULL,
            badge_slug TEXT NOT NULL,
            awarded_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, badge_slug),
            FOREIGN KEY (badge_slug) REFERENCES badges(slug)
          );
        `);
                // Seed default system badges
                const seedBadge = this.db.prepare(`
          INSERT OR IGNORE INTO badges (slug, name, description, tier, emoji)
          VALUES (?, ?, ?, ?, ?)
        `);
                seedBadge.run("verified_member", "Verified Operative", "Completed server safety & gamer clearance", "mythic", "🛡️");
                seedBadge.run("squad_pioneer", "Squad Pioneer", "Founding member of GAMING SHAMING", "gold", "⚡");
                seedBadge.run("coop_veteran", "Co-op Specialist", "Multiplayer co-op squad member", "diamond", "🤝");
                seedBadge.run("tourney_fighter", "Tourney Gladiator", "Participated in community scrims", "silver", "⚔️");
                seedBadge.run("party_host", "Squad Captain", "Active LFG party coordinator", "bronze", "🎮");
                const insertVer2 = this.db.prepare("INSERT INTO schema_versions (version, applied_at, description) VALUES (2, ?, 'Phase 2: Member profiles, achievement badges, and reputation/XP tracking')");
                insertVer2.run(Date.now());
            }
            // Check if schema_versions has version 3
            const checkVer3 = this.db.prepare("SELECT * FROM schema_versions WHERE version = 3");
            const ver3 = checkVer3.all();
            if (ver3.length === 0) {
                this.db.exec(`
          CREATE TABLE IF NOT EXISTS lfg_parties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            host_user_id TEXT NOT NULL,
            game_slug TEXT NOT NULL,
            game_name TEXT NOT NULL,
            platform TEXT NOT NULL,
            playstyle TEXT NOT NULL,
            activity TEXT NOT NULL,
            max_slots INTEGER NOT NULL DEFAULT 4,
            status TEXT NOT NULL DEFAULT 'open',
            channel_id TEXT,
            message_id TEXT,
            voice_channel_id TEXT,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
          );

          CREATE TABLE IF NOT EXISTS lfg_party_members (
            party_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            joined_at INTEGER NOT NULL,
            PRIMARY KEY (party_id, user_id),
            FOREIGN KEY (party_id) REFERENCES lfg_parties(id) ON DELETE CASCADE
          );

          CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            tag TEXT NOT NULL UNIQUE,
            captain_user_id TEXT NOT NULL,
            game_slug TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );

          CREATE TABLE IF NOT EXISTS team_members (
            team_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            joined_at INTEGER NOT NULL,
            PRIMARY KEY (team_id, user_id),
            FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
          );

          CREATE TABLE IF NOT EXISTS automation_feeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feed_type TEXT NOT NULL,
            external_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content_json TEXT NOT NULL,
            posted_channel_id TEXT,
            posted_message_id TEXT,
            created_at INTEGER NOT NULL,
            UNIQUE(feed_type, external_id)
          );

          CREATE TABLE IF NOT EXISTS automation_config (
            feed_type TEXT PRIMARY KEY,
            enabled INTEGER NOT NULL DEFAULT 1,
            channel_id TEXT NOT NULL,
            last_polled_at INTEGER NOT NULL DEFAULT 0,
            poll_interval_minutes INTEGER NOT NULL DEFAULT 60
          );
        `);
                // Seed default automation channels
                const seedConfig = this.db.prepare(`
          INSERT OR IGNORE INTO automation_config (feed_type, enabled, channel_id, last_polled_at, poll_interval_minutes)
          VALUES (?, ?, ?, ?, ?)
        `);
                seedConfig.run("steam_deals", 1, "1566922341769023603", 0, 120); // #game-news
                seedConfig.run("free_games", 1, "1566922341769023603", 0, 60); // #game-news
                seedConfig.run("game_news", 1, "1566922341769023603", 0, 180); // #game-news
                seedConfig.run("community_report", 1, "1566922320130351275", 0, 10080); // #server-updates (weekly)
                const insertVer3 = this.db.prepare("INSERT INTO schema_versions (version, applied_at, description) VALUES (3, ?, 'Phase 4 & 6: LFG matchmaking, squad teams, and content automation feeds')");
                insertVer3.run(Date.now());
            }
        }
        catch {
            // Ignore if already applied
        }
    }
    /**
     * Applies schema migrations up to target version.
     */
    migrate(toVersion) {
        if (toVersion >= 1) {
            this.runMigrations();
        }
    }
    /**
     * Safe rollback mechanism for schema versions.
     */
    rollback(toVersion) {
        if (toVersion === 0) {
            this.db.exec(`
        DELETE FROM schema_versions WHERE version >= 1;
      `);
        }
    }
    /**
     * Records member screening events with explicit state separation:
     * 1. Rules Screening (Discord native pending flag)
     * 2. Native Onboarding Status (Discord Community Onboarding is NOT observable via gateway)
     * 3. Custom AI Verification Status
     */
    recordScreeningEvent(userId, guildId, eventType, pendingBefore, pendingAfter, options) {
        const now = Date.now();
        const rulesComplete = options?.rulesScreeningComplete ?? (pendingBefore === true && pendingAfter === false);
        // Explicitly document that native onboarding is NOT observable via gateway events
        const nativeStatus = options?.nativeOnboardingStatus ?? "unknown_not_observable";
        const customStatus = options?.customVerificationStatus ?? "not_started";
        const answersData = options?.customAnswers ?? (options?.notes ? { notes: options.notes } : options);
        const stmt = this.db.prepare(`
      INSERT INTO member_screening_events (
        user_id, guild_id, event_type, pending_before, pending_after,
        rules_screening_complete, native_onboarding_status, custom_verification_status,
        custom_answers, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(userId, guildId, eventType, pendingBefore === null ? null : (pendingBefore ? 1 : 0), pendingAfter === null ? null : (pendingAfter ? 1 : 0), rulesComplete ? 1 : 0, nativeStatus, customStatus, answersData ? JSON.stringify(answersData) : null, now);
    }
    // ─── Database-Backed Idempotent Verification Sessions ────────────────────────
    /**
     * Atomically gets or creates a verification session for guild + user.
     * If an active or completed session already exists, it is NOT overwritten,
     * guaranteeing that duplicate gateway events cannot reset progress.
     */
    getOrCreateVerificationSession(guildId, userId) {
        const now = Date.now();
        const insert = this.db.prepare(`
      INSERT INTO verification_sessions (guild_id, user_id, step, status, answers_json, reminded, created_at, updated_at)
      VALUES (?, ?, 'agree', 'in_progress', '{}', 0, ?, ?)
      ON CONFLICT(guild_id, user_id) DO NOTHING
    `);
        const info = insert.run(guildId, userId, now, now);
        const created = info.changes > 0;
        const session = this.getVerificationSession(guildId, userId);
        return { created, session };
    }
    getVerificationSession(guildId, userId) {
        const stmt = this.db.prepare("SELECT * FROM verification_sessions WHERE guild_id = ? AND user_id = ?");
        const res = stmt.all(guildId, userId);
        if (!res || res.length === 0)
            return null;
        const row = res[0];
        let answers = {};
        try {
            answers = JSON.parse(row.answers_json || "{}");
        }
        catch {
            answers = {};
        }
        return {
            id: row.id,
            guild_id: row.guild_id,
            user_id: row.user_id,
            step: row.step,
            status: row.status,
            review_reason: row.review_reason,
            answers,
            reminded: Boolean(row.reminded),
            created_at: row.created_at,
            updated_at: row.updated_at,
            completed_at: row.completed_at
        };
    }
    /**
     * Updates session step and/or answers atomically.
     */
    updateVerificationSession(guildId, userId, update) {
        const existing = this.getVerificationSession(guildId, userId);
        if (!existing)
            return null;
        const newStep = update.step !== undefined ? update.step : existing.step;
        const newAnswers = update.answers !== undefined ? update.answers : existing.answers;
        const newReminded = update.reminded !== undefined ? (update.reminded ? 1 : 0) : (existing.reminded ? 1 : 0);
        const newStatus = update.status !== undefined ? update.status : existing.status;
        const newReason = update.review_reason !== undefined ? update.review_reason : existing.review_reason;
        const completedAt = newStatus === "completed" ? Date.now() : existing.completed_at;
        const now = Date.now();
        const stmt = this.db.prepare(`
      UPDATE verification_sessions
      SET step = ?, answers_json = ?, reminded = ?, status = ?, review_reason = ?, updated_at = ?, completed_at = ?
      WHERE guild_id = ? AND user_id = ?
    `);
        stmt.run(newStep, JSON.stringify(newAnswers), newReminded, newStatus, newReason ?? null, now, completedAt ?? null, guildId, userId);
        return this.getVerificationSession(guildId, userId);
    }
    completeVerificationSession(guildId, userId) {
        return this.updateVerificationSession(guildId, userId, {
            step: "done",
            status: "completed"
        });
    }
    setVerificationSessionReview(guildId, userId, reason) {
        return this.updateVerificationSession(guildId, userId, {
            status: "review",
            review_reason: reason
        });
    }
    getAllActiveVerificationSessions(guildId) {
        const stmt = guildId
            ? this.db.prepare("SELECT * FROM verification_sessions WHERE guild_id = ? AND status = 'in_progress'")
            : this.db.prepare("SELECT * FROM verification_sessions WHERE status = 'in_progress'");
        const rows = (guildId ? stmt.all(guildId) : stmt.all());
        return rows.map(row => {
            let answers = {};
            try {
                answers = JSON.parse(row.answers_json || "{}");
            }
            catch {
                answers = {};
            }
            return {
                id: row.id,
                guild_id: row.guild_id,
                user_id: row.user_id,
                step: row.step,
                status: row.status,
                review_reason: row.review_reason,
                answers,
                reminded: Boolean(row.reminded),
                created_at: row.created_at,
                updated_at: row.updated_at,
                completed_at: row.completed_at
            };
        });
    }
    /**
     * Data minimization / retention policy:
     * Prunes completed sessions older than retentionDays.
     */
    pruneVerificationSessions(retentionDays = 30) {
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const stmt = this.db.prepare("DELETE FROM verification_sessions WHERE status = 'completed' AND completed_at < ?");
        const info = stmt.run(cutoff);
        return info.changes || 0;
    }
    getScreeningEventsForUser(userId) {
        const stmt = this.db.prepare("SELECT * FROM member_screening_events WHERE user_id = ? ORDER BY timestamp DESC");
        return stmt.all(userId);
    }
    seedCategoriesAndGames(catalogPath) {
        const file = catalogPath || path.resolve(process.cwd(), "templates/games-directory.json");
        if (!fs.existsSync(file))
            return;
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));
        const now = Date.now();
        const insertCat = this.db.prepare(`
      INSERT OR IGNORE INTO game_categories (id, name, max_channels, created_at)
      VALUES (?, ?, ?, ?)
    `);
        const insertGame = this.db.prepare(`
      INSERT OR IGNORE INTO games (name, slug, category_id, role_name, role_color, member_count, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
        for (const cat of data.categories) {
            insertCat.run(cat.id, cat.name, cat.maxChannels || 20, now);
            for (const g of cat.games) {
                insertGame.run(g.name, g.slug, cat.id, g.role, g.color, now);
            }
        }
    }
    getAllGames() {
        const stmt = this.db.prepare("SELECT * FROM games ORDER BY category_id, name");
        return stmt.all();
    }
    getGamesByCategory(categoryId) {
        const stmt = this.db.prepare("SELECT * FROM games WHERE category_id = ? ORDER BY name");
        return stmt.all(categoryId);
    }
    getGameBySlug(slug) {
        const stmt = this.db.prepare("SELECT * FROM games WHERE slug = ? OR lower(name) = lower(?)");
        const res = stmt.all(slug, slug);
        return res.length > 0 ? res[0] : null;
    }
    addGame(game) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO games (name, slug, category_id, role_name, role_color, member_count, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
        stmt.run(game.name, game.slug, game.category_id, game.role_name, game.role_color, now);
        return this.getGameBySlug(game.slug);
    }
    updateGameDiscordResources(slug, resources) {
        const current = this.getGameBySlug(slug);
        if (!current)
            return;
        const textId = resources.text_channel_id !== undefined ? (resources.text_channel_id ?? null) : (current.text_channel_id ?? null);
        const voiceId = resources.voice_channel_id !== undefined ? (resources.voice_channel_id ?? null) : (current.voice_channel_id ?? null);
        const roleId = resources.role_id !== undefined ? (resources.role_id ?? null) : (current.role_id ?? null);
        const stmt = this.db.prepare(`
      UPDATE games SET text_channel_id = ?, voice_channel_id = ?, role_id = ? WHERE slug = ?
    `);
        stmt.run(textId, voiceId, roleId, current.slug);
    }
    updateCategoryDiscordId(categoryId, discordCategoryId) {
        const stmt = this.db.prepare("UPDATE game_categories SET discord_category_id = ? WHERE id = ?");
        stmt.run(discordCategoryId, categoryId);
    }
    getCategory(categoryId) {
        const stmt = this.db.prepare("SELECT * FROM game_categories WHERE id = ?");
        const res = stmt.all(categoryId);
        return res.length > 0 ? res[0] : null;
    }
    getAllCategories() {
        const stmt = this.db.prepare("SELECT * FROM game_categories ORDER BY name");
        return stmt.all();
    }
    recordMemberGame(userId, gameSlug, platform, skill) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO member_game_profiles (user_id, game_slug, platform, skill, added_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, game_slug) DO UPDATE SET platform = excluded.platform, skill = excluded.skill
    `);
        stmt.run(userId, gameSlug, platform, skill, now);
        // Update game member count
        const countStmt = this.db.prepare(`
      UPDATE games SET member_count = (SELECT COUNT(*) FROM member_game_profiles WHERE game_slug = ?) WHERE slug = ?
    `);
        countStmt.run(gameSlug, gameSlug);
    }
    createGameRequest(gameName, categoryId, userId) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO game_requests (game_name, category_id, requested_by_user_id, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `);
        stmt.run(gameName, categoryId, userId, now);
        const getStmt = this.db.prepare("SELECT * FROM game_requests WHERE rowid = last_insert_rowid()");
        return getStmt.all()[0];
    }
    getPendingRequests() {
        const stmt = this.db.prepare("SELECT * FROM game_requests WHERE status = 'pending' ORDER BY created_at ASC");
        return stmt.all();
    }
    close() {
        this.db.close();
    }
    resolveGameRequest(id, status, moderatorId, reason) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      UPDATE game_requests SET status = ?, moderator_id = ?, moderator_reason = ?, updated_at = ? WHERE id = ?
    `);
        stmt.run(status, moderatorId, reason ?? null, now, id);
        const check = this.db.prepare("SELECT * FROM game_requests WHERE id = ?");
        const res = check.all(id);
        return res.length > 0 ? res[0] : null;
    }
    logAudit(action, details, operatorId) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO audit_logs (action, details, operator_id, timestamp)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(action, details, operatorId || "system", now);
    }
    getRecentAuditLogs(limit = 20) {
        const stmt = this.db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?");
        return stmt.all(limit);
    }
    // ─── Phase 2: Member Profiles, Badges & Reputation ─────────────────────────
    getMemberProfile(userId) {
        const stmt = this.db.prepare("SELECT * FROM member_profiles WHERE user_id = ?");
        const res = stmt.all(userId);
        if (!res || res.length === 0)
            return null;
        return res[0];
    }
    upsertMemberProfile(data) {
        const existing = this.getMemberProfile(data.user_id);
        const now = Date.now();
        if (!existing) {
            const stmt = this.db.prepare(`
        INSERT INTO member_profiles (
          user_id, bio, primary_game, platform, playstyle, timing, timezone,
          reputation, xp, level, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(data.user_id, data.bio || "", data.primary_game || "Apex Legends", data.platform || "PC", data.playstyle || "Casual", data.timing || "Evenings", data.timezone || "UTC", data.reputation ?? 0, data.xp ?? 0, data.level ?? 1, now, now);
        }
        else {
            const stmt = this.db.prepare(`
        UPDATE member_profiles
        SET bio = ?, primary_game = ?, platform = ?, playstyle = ?, timing = ?, timezone = ?,
            reputation = ?, xp = ?, level = ?, updated_at = ?
        WHERE user_id = ?
      `);
            stmt.run(data.bio !== undefined ? data.bio : existing.bio, data.primary_game !== undefined ? data.primary_game : existing.primary_game, data.platform !== undefined ? data.platform : existing.platform, data.playstyle !== undefined ? data.playstyle : existing.playstyle, data.timing !== undefined ? data.timing : existing.timing, data.timezone !== undefined ? data.timezone : existing.timezone, data.reputation !== undefined ? data.reputation : existing.reputation, data.xp !== undefined ? data.xp : existing.xp, data.level !== undefined ? data.level : existing.level, now, data.user_id);
        }
        return this.getMemberProfile(data.user_id);
    }
    getAllBadges() {
        const stmt = this.db.prepare("SELECT * FROM badges ORDER BY slug");
        return stmt.all();
    }
    getMemberBadges(userId) {
        const stmt = this.db.prepare(`
      SELECT b.slug, b.name, b.description, b.tier, b.emoji, mb.awarded_at
      FROM member_badges mb
      JOIN badges b ON mb.badge_slug = b.slug
      WHERE mb.user_id = ?
      ORDER BY mb.awarded_at DESC
    `);
        return stmt.all(userId);
    }
    awardBadge(userId, badgeSlug) {
        const now = Date.now();
        try {
            const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO member_badges (user_id, badge_slug, awarded_at)
        VALUES (?, ?, ?)
      `);
            const info = stmt.run(userId, badgeSlug, now);
            return info.changes > 0;
        }
        catch {
            return false;
        }
    }
    addReputation(userId, delta) {
        const profile = this.getMemberProfile(userId) || this.upsertMemberProfile({ user_id: userId });
        const newRep = Math.max(0, profile.reputation + delta);
        this.upsertMemberProfile({ user_id: userId, reputation: newRep });
        return newRep;
    }
    addXp(userId, delta) {
        const profile = this.getMemberProfile(userId) || this.upsertMemberProfile({ user_id: userId });
        const newXp = Math.max(0, profile.xp + delta);
        // Level formula: level = Math.floor(Math.sqrt(xp / 100)) + 1
        const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)) + 1);
        const leveledUp = newLevel > profile.level;
        this.upsertMemberProfile({
            user_id: userId,
            xp: newXp,
            level: newLevel
        });
        return { xp: newXp, level: newLevel, leveledUp };
    }
    getLeaderboard(limit = 10) {
        const stmt = this.db.prepare(`
      SELECT * FROM member_profiles
      ORDER BY level DESC, xp DESC, reputation DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map((r, i) => ({ ...r, rank: i + 1 }));
    }
    // ─── Phase 4: LFG Matchmaking & Squad Management ──────────────────────────
    createLfgParty(data) {
        const now = Date.now();
        const expiresAt = now + (data.durationMinutes || 120) * 60 * 1000;
        const maxSlots = Math.max(2, Math.min(10, data.max_slots || 4));
        // Prevent duplicate active open requests from same host
        const existing = this.db.prepare(`
      SELECT id FROM lfg_parties
      WHERE host_user_id = ? AND status = 'open' AND expires_at > ?
    `).all(data.host_user_id, now);
        if (existing.length > 0) {
            return {
                success: false,
                error: "You already have an active LFG party open. Close or finish it before creating a new one."
            };
        }
        const insert = this.db.prepare(`
      INSERT INTO lfg_parties (
        host_user_id, game_slug, game_name, platform, playstyle, activity,
        max_slots, status, created_at, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `);
        const res = insert.run(data.host_user_id, data.game_slug, data.game_name, data.platform, data.playstyle, data.activity, maxSlots, now, expiresAt);
        const partyId = Number(res.lastInsertRowid);
        // Host automatically joins party
        this.db.prepare(`
      INSERT INTO lfg_party_members (party_id, user_id, joined_at)
      VALUES (?, ?, ?)
    `).run(partyId, data.host_user_id, now);
        const party = this.getLfgParty(partyId);
        return { success: true, party };
    }
    getLfgParty(id) {
        const stmt = this.db.prepare("SELECT * FROM lfg_parties WHERE id = ?");
        const res = stmt.all(id);
        if (!res || res.length === 0)
            return null;
        const row = res[0];
        const memberStmt = this.db.prepare("SELECT user_id FROM lfg_party_members WHERE party_id = ? ORDER BY joined_at ASC");
        const members = memberStmt.all(id).map(m => m.user_id);
        row.members = members;
        return row;
    }
    getActiveLfgParties(gameSlug) {
        const now = Date.now();
        let query = "SELECT * FROM lfg_parties WHERE status IN ('open', 'full') AND expires_at > ?";
        const params = [now];
        if (gameSlug) {
            query += " AND game_slug = ?";
            params.push(gameSlug);
        }
        query += " ORDER BY created_at DESC";
        const rows = this.db.prepare(query).all(...params);
        return rows.map(r => {
            const memberStmt = this.db.prepare("SELECT user_id FROM lfg_party_members WHERE party_id = ? ORDER BY joined_at ASC");
            r.members = memberStmt.all(r.id).map(m => m.user_id);
            return r;
        });
    }
    joinLfgParty(partyId, userId) {
        const party = this.getLfgParty(partyId);
        if (!party)
            return { success: false, error: "Party not found." };
        if (party.status !== "open")
            return { success: false, error: `Party is ${party.status}.` };
        if (party.expires_at <= Date.now())
            return { success: false, error: "Party has expired." };
        if (party.members && party.members.includes(userId)) {
            return { success: false, error: "You are already a member of this party." };
        }
        if (party.members && party.members.length >= party.max_slots) {
            this.db.prepare("UPDATE lfg_parties SET status = 'full' WHERE id = ?").run(partyId);
            return { success: false, error: "Party is full." };
        }
        const now = Date.now();
        this.db.prepare(`
      INSERT OR IGNORE INTO lfg_party_members (party_id, user_id, joined_at)
      VALUES (?, ?, ?)
    `).run(partyId, userId, now);
        const updated = this.getLfgParty(partyId);
        if (updated.members && updated.members.length >= updated.max_slots) {
            this.db.prepare("UPDATE lfg_parties SET status = 'full' WHERE id = ?").run(partyId);
            updated.status = "full";
        }
        return { success: true, party: updated };
    }
    leaveLfgParty(partyId, userId) {
        const party = this.getLfgParty(partyId);
        if (!party)
            return { success: false, error: "Party not found." };
        if (!party.members || !party.members.includes(userId)) {
            return { success: false, error: "You are not in this party." };
        }
        if (party.host_user_id === userId) {
            // Host left, cancel party
            this.db.prepare("UPDATE lfg_parties SET status = 'cancelled' WHERE id = ?").run(partyId);
            const updated = this.getLfgParty(partyId);
            return { success: true, party: updated };
        }
        this.db.prepare("DELETE FROM lfg_party_members WHERE party_id = ? AND user_id = ?").run(partyId, userId);
        const updated = this.getLfgParty(partyId);
        if (updated.status === "full" && updated.members && updated.members.length < updated.max_slots) {
            this.db.prepare("UPDATE lfg_parties SET status = 'open' WHERE id = ?").run(partyId);
            updated.status = "open";
        }
        return { success: true, party: updated };
    }
    closeLfgParty(partyId, hostUserId) {
        if (hostUserId) {
            const stmt = this.db.prepare("UPDATE lfg_parties SET status = 'closed' WHERE id = ? AND host_user_id = ?");
            const res = stmt.run(partyId, hostUserId);
            return res.changes > 0;
        }
        else {
            const stmt = this.db.prepare("UPDATE lfg_parties SET status = 'closed' WHERE id = ?");
            const res = stmt.run(partyId);
            return res.changes > 0;
        }
    }
    updateLfgPartyMessage(partyId, arg2, arg3, arg4) {
        let channelId = null;
        let messageId;
        let voiceChannelId = null;
        if (arg3 !== undefined) {
            channelId = arg2;
            messageId = arg3;
            voiceChannelId = arg4 ?? null;
        }
        else {
            messageId = arg2;
        }
        if (channelId) {
            const stmt = this.db.prepare(`
        UPDATE lfg_parties
        SET channel_id = ?, message_id = ?, voice_channel_id = COALESCE(?, voice_channel_id)
        WHERE id = ?
      `);
            stmt.run(channelId, messageId, voiceChannelId, partyId);
        }
        else {
            const stmt = this.db.prepare(`
        UPDATE lfg_parties
        SET message_id = ?
        WHERE id = ?
      `);
            stmt.run(messageId, partyId);
        }
    }
    createTeam(nameOrData, tagArg, captainIdArg, gameSlugArg) {
        let name;
        let tag;
        let captainId;
        let gameSlug;
        if (typeof nameOrData === "object") {
            name = nameOrData.name;
            tag = nameOrData.tag;
            captainId = nameOrData.captain_user_id || nameOrData.leader_user_id || "";
            gameSlug = nameOrData.game_slug || nameOrData.gameSlug || "general";
        }
        else {
            name = nameOrData;
            tag = tagArg || "";
            captainId = captainIdArg || "";
            gameSlug = gameSlugArg || "general";
        }
        const now = Date.now();
        const cleanTag = tag.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
        const cleanName = name.trim().slice(0, 32);
        try {
            const stmt = this.db.prepare(`
        INSERT INTO teams (name, tag, captain_user_id, game_slug, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
            const res = stmt.run(cleanName, cleanTag, captainId, gameSlug, now);
            const teamId = Number(res.lastInsertRowid);
            this.db.prepare(`
        INSERT INTO team_members (team_id, user_id, role, joined_at)
        VALUES (?, ?, 'captain', ?)
      `).run(teamId, captainId, now);
            const team = this.getTeam(teamId);
            return { success: true, team };
        }
        catch (err) {
            if (err.message?.includes("UNIQUE")) {
                return { success: false, error: "A team with that name or clan tag already exists." };
            }
            return { success: false, error: err.message };
        }
    }
    getTeam(idOrTag) {
        const stmt = typeof idOrTag === "number" || !isNaN(Number(idOrTag))
            ? this.db.prepare("SELECT * FROM teams WHERE id = ?")
            : this.db.prepare("SELECT * FROM teams WHERE lower(tag) = lower(?) OR lower(name) = lower(?)");
        const res = stmt.all(idOrTag);
        if (!res || res.length === 0)
            return null;
        const team = res[0];
        const members = this.db.prepare("SELECT user_id, role, joined_at FROM team_members WHERE team_id = ? ORDER BY joined_at ASC").all(team.id);
        team.members = members;
        return team;
    }
    getUserTeams(userId) {
        const stmt = this.db.prepare(`
      SELECT t.* FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ?
      ORDER BY t.created_at DESC
    `);
        const rows = stmt.all(userId);
        return rows.map(t => {
            t.members = this.db.prepare("SELECT user_id, role, joined_at FROM team_members WHERE team_id = ?").all(t.id);
            return t;
        });
    }
    addTeamMember(teamId, userId, role = "member") {
        const now = Date.now();
        try {
            const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO team_members (team_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?)
      `);
            const res = stmt.run(teamId, userId, role, now);
            return res.changes > 0;
        }
        catch {
            return false;
        }
    }
    removeTeamMember(teamId, userId) {
        const stmt = this.db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?");
        const res = stmt.run(teamId, userId);
        return res.changes > 0;
    }
    // ─── Phase 6: Content Automation Feeds ─────────────────────────────────────
    recordAutomationFeed(feedType, externalId, title, contentJson, channelId, messageId) {
        const now = Date.now();
        try {
            const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO automation_feeds (
          feed_type, external_id, title, content_json, posted_channel_id, posted_message_id, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
            const res = stmt.run(feedType, externalId, title, JSON.stringify(contentJson || {}), channelId ?? null, messageId ?? null, now);
            return res.changes > 0;
        }
        catch {
            return false;
        }
    }
    hasAutomationFeed(feedType, externalId) {
        const stmt = this.db.prepare("SELECT id FROM automation_feeds WHERE feed_type = ? AND external_id = ?");
        const res = stmt.all(feedType, externalId);
        return res.length > 0;
    }
    getRecentAutomationFeeds(feedType, limit = 10) {
        const stmt = feedType
            ? this.db.prepare("SELECT * FROM automation_feeds WHERE feed_type = ? ORDER BY created_at DESC LIMIT ?")
            : this.db.prepare("SELECT * FROM automation_feeds ORDER BY created_at DESC LIMIT ?");
        const rows = (feedType ? stmt.all(feedType, limit) : stmt.all(limit));
        return rows;
    }
    getAutomationConfig(feedType) {
        if (!feedType) {
            const stmt = this.db.prepare("SELECT * FROM automation_config");
            const rows = stmt.all();
            return rows.map(row => ({
                feed_type: row.feed_type,
                enabled: Boolean(row.enabled),
                channel_id: row.channel_id,
                last_polled_at: row.last_polled_at,
                poll_interval_minutes: row.poll_interval_minutes
            }));
        }
        const stmt = this.db.prepare("SELECT * FROM automation_config WHERE feed_type = ?");
        const res = stmt.all(feedType);
        if (!res || res.length === 0)
            return null;
        const row = res[0];
        return {
            feed_type: row.feed_type,
            enabled: Boolean(row.enabled),
            channel_id: row.channel_id,
            last_polled_at: row.last_polled_at,
            poll_interval_minutes: row.poll_interval_minutes
        };
    }
    updateAutomationPolled(feedType) {
        const now = Date.now();
        this.db.prepare("UPDATE automation_config SET last_polled_at = ? WHERE feed_type = ?").run(now, feedType);
    }
}
//# sourceMappingURL=game-db.js.map