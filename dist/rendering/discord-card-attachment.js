import { AttachmentBuilder } from "discord.js";
/**
 * Creates a Discord AttachmentBuilder from a generated image buffer.
 */
export function createCardAttachment(buffer, filename) {
    return new AttachmentBuilder(buffer, { name: filename });
}
/**
 * Attaches a generated card image to an EmbedBuilder as its primary display image.
 */
export function attachCardToEmbed(embed, filename) {
    return embed.setImage(`attachment://${filename}`);
}
/**
 * Safe card execution boundary.
 * Renders the card buffer, or if rendering fails, returns null so the caller can send
 * a rich text fallback embed without crashing the bot interaction.
 */
export async function safeRenderCard(renderFn, params, logger) {
    try {
        return await renderFn(params);
    }
    catch (err) {
        if (logger) {
            logger(err);
        }
        else {
            process.stderr.write(`[CardRenderer] Warning: Card render failed gracefully: ${err?.message || err}\n`);
        }
        return null;
    }
}
//# sourceMappingURL=discord-card-attachment.js.map