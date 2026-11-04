import { ChatInputCommandInteraction } from "discord.js";
import { DynamicGameManager } from "./game-manager.js";
import { GameDatabase } from "./game-db.js";
export declare function buildGameCommands(): (import("discord.js").SlashCommandOptionsOnlyBuilder | import("discord.js").SlashCommandSubcommandsOnlyBuilder)[];
export declare function handleGameCommands(interaction: ChatInputCommandInteraction, gameManager: DynamicGameManager): Promise<void>;
/**
 * Handles Phase 2 Slash Commands: /profile, /setup-profile, /edit-profile, /badges, /rank, /leaderboard.
 */
export declare function handleMemberIdentityCommands(interaction: ChatInputCommandInteraction, db: GameDatabase): Promise<boolean>;
/**
 * Handles Phase 2 interactive components (Buttons, Select Menus, Modals).
 */
export declare function handleMemberIdentityComponents(interaction: any, db: GameDatabase): Promise<boolean>;
