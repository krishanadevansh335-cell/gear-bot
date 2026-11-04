import { AttachmentBuilder, EmbedBuilder } from "discord.js";
/**
 * Creates a Discord AttachmentBuilder from a generated image buffer.
 */
export declare function createCardAttachment(buffer: Buffer, filename: string): AttachmentBuilder;
/**
 * Attaches a generated card image to an EmbedBuilder as its primary display image.
 */
export declare function attachCardToEmbed(embed: EmbedBuilder, filename: string): EmbedBuilder;
/**
 * Safe card execution boundary.
 * Renders the card buffer, or if rendering fails, returns null so the caller can send
 * a rich text fallback embed without crashing the bot interaction.
 */
export declare function safeRenderCard<T>(renderFn: (params: T) => Promise<Buffer>, params: T, logger?: (err: any) => void): Promise<Buffer | null>;
