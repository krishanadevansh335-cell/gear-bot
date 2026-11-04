import { Guild, CategoryChannel } from "discord.js";
import { GameDatabase, GameDefinition } from "./game-db.js";
export interface ProvisionGameResult {
    game: GameDefinition;
    createdText: boolean;
    createdVoice: boolean;
    createdRole: boolean;
    categoryName: string;
    error?: string;
}
export declare class DynamicGameManager {
    private guild;
    private db;
    constructor(guild: Guild, db?: GameDatabase);
    getDatabase(): GameDatabase;
    /**
     * Ensures the 6 game categories exist in the server.
     * Permissions: Visible to Verified members, but hidden from @everyone unverified.
     */
    ensureGameCategories(): Promise<Map<string, CategoryChannel>>;
    /**
     * Idempotently creates a game role, text channel, and voice channel on demand.
     * Only called when members select the game or moderators approve a request.
     */
    provisionGameResources(slugOrName: string, options?: {
        createVoice?: boolean;
    }): Promise<ProvisionGameResult>;
    /**
     * Registers a user's selection of a game, assigns the game role,
     * dynamically provisions the channel if this is the first interested player,
     * and preserves minor/adult separation.
     */
    addMemberToGame(userId: string, gameSlug: string, platform: string, skill: string): Promise<{
        success: boolean;
        message: string;
        roleAdded: string;
    }>;
}
