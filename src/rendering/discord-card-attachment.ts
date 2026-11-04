import { AttachmentBuilder, EmbedBuilder } from "discord.js";

/**
 * Creates a Discord AttachmentBuilder from a generated image buffer.
 */
export function createCardAttachment(buffer: Buffer, filename: string): AttachmentBuilder {
  return new AttachmentBuilder(buffer, { name: filename });
}

/**
 * Attaches a generated card image to an EmbedBuilder as its primary display image.
 */
export function attachCardToEmbed(embed: EmbedBuilder, filename: string): EmbedBuilder {
  return embed.setImage(`attachment://${filename}`);
}

/**
 * Safe card execution boundary.
 * Renders the card buffer, or if rendering fails, returns null so the caller can send
 * a rich text fallback embed without crashing the bot interaction.
 */
export async function safeRenderCard<T>(
  renderFn: (params: T) => Promise<Buffer>,
  params: T,
  logger?: (err: any) => void
): Promise<Buffer | null> {
  try {
    return await renderFn(params);
  } catch (err: any) {
    if (logger) {
      logger(err);
    } else {
      process.stderr.write(`[CardRenderer] Warning: Card render failed gracefully: ${err?.message || err}\n`);
    }
    return null;
  }
}
