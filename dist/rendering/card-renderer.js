import { createCanvas, loadImage } from "@napi-rs/canvas";
import { GifWriter } from "omggif";
import { BRAND_COLORS, BADGE_TIERS } from "../identity/design-tokens.js";
/**
 * Creates a canvas with high-dpi-safe rendering context.
 */
export function createBaseCanvas(width, height) {
    return createCanvas(width, height);
}
/**
 * Draws the signature GAMING SHAMING cyberpunk background with dark obsidian gradient,
 * subtle tech grid, diagonal neon corner accents, and vignette.
 */
export function drawCyberpunkBackground(ctx, width, height, options = {}) {
    const { primaryAccent = BRAND_COLORS.primaryPurple, secondaryAccent = BRAND_COLORS.secondaryCyan, gridOpacity = 0.08, showScanlines = true, scanlineOffset = 0, glitchSlice = false } = options;
    // 1. Base gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, BRAND_COLORS.backgroundObsidian);
    bgGrad.addColorStop(0.5, "#10141D");
    bgGrad.addColorStop(1, BRAND_COLORS.backgroundSurface);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    // 2. Tech grid
    ctx.save();
    ctx.strokeStyle = `rgba(0, 240, 255, ${gridOpacity})`;
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    ctx.restore();
    // 3. Subtle ambient glow orbs (Top left purple, Bottom right cyan)
    ctx.save();
    const radGlow1 = ctx.createRadialGradient(80, 80, 10, 80, 80, 280);
    radGlow1.addColorStop(0, "rgba(138, 43, 226, 0.25)");
    radGlow1.addColorStop(1, "rgba(138, 43, 226, 0)");
    ctx.fillStyle = radGlow1;
    ctx.fillRect(0, 0, 400, 400);
    const radGlow2 = ctx.createRadialGradient(width - 80, height - 80, 10, width - 80, height - 80, 320);
    radGlow2.addColorStop(0, "rgba(0, 240, 255, 0.20)");
    radGlow2.addColorStop(1, "rgba(0, 240, 255, 0)");
    ctx.fillStyle = radGlow2;
    ctx.fillRect(width - 500, height - 500, 500, 500);
    ctx.restore();
    // 4. Subtle scanlines for CRT/esports effect
    if (showScanlines) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        for (let y = (scanlineOffset % 6); y < height; y += 4) {
            ctx.fillRect(0, y, width, 1.5);
        }
        ctx.restore();
    }
    // 5. Border frame with chamfered corners
    const pad = 12;
    const cut = 16;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pad + cut, pad);
    ctx.lineTo(width - pad - cut, pad);
    ctx.lineTo(width - pad, pad + cut);
    ctx.lineTo(width - pad, height - pad - cut);
    ctx.lineTo(width - pad - cut, height - pad);
    ctx.lineTo(pad + cut, height - pad);
    ctx.lineTo(pad, height - pad - cut);
    ctx.lineTo(pad, pad + cut);
    ctx.closePath();
    ctx.strokeStyle = BRAND_COLORS.borderDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Neon corner brackets
    ctx.strokeStyle = primaryAccent;
    ctx.lineWidth = 2.5;
    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(pad, pad + cut + 25);
    ctx.lineTo(pad, pad + cut);
    ctx.lineTo(pad + cut, pad);
    ctx.lineTo(pad + cut + 25, pad);
    ctx.stroke();
    // Bottom-right bracket
    ctx.strokeStyle = secondaryAccent;
    ctx.beginPath();
    ctx.moveTo(width - pad - cut - 25, height - pad);
    ctx.lineTo(width - pad - cut, height - pad);
    ctx.lineTo(width - pad, height - pad - cut);
    ctx.lineTo(width - pad, height - pad - cut - 25);
    ctx.stroke();
    ctx.restore();
    // 6. Optional glitch horizontal slice
    if (glitchSlice) {
        ctx.save();
        const sliceY = 60 + Math.floor(Math.random() * (height - 120));
        const sliceHeight = 6 + Math.floor(Math.random() * 8);
        ctx.fillStyle = "rgba(0, 240, 255, 0.35)";
        ctx.fillRect(pad, sliceY, width - (pad * 2), sliceHeight);
        ctx.fillStyle = "rgba(255, 51, 102, 0.30)";
        ctx.fillRect(pad + 4, sliceY + 2, width - (pad * 2) - 8, sliceHeight / 2);
        ctx.restore();
    }
}
/**
 * Draws text with a vibrant neon outer glow.
 */
export function drawGlowText(ctx, text, x, y, options = {}) {
    const { font = "bold 24px sans-serif", color = BRAND_COLORS.textPrimary, glowColor = BRAND_COLORS.primaryPurple, glowBlur = 12, align = "left", baseline = "alphabetic" } = options;
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    // Glow pass
    if (glowBlur > 0 && glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = glowBlur;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.shadowBlur = glowBlur / 2;
        ctx.fillText(text, x, y);
    }
    // Crisp foreground pass
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}
/**
 * Draws a sharp geometric hexagon (useful for gaming badges and stats).
 */
export function drawHexagon(ctx, x, y, radius, strokeColor, fillColor, lineWidth = 2) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const hx = x + radius * Math.cos(angle);
        const hy = y + radius * Math.sin(angle);
        if (i === 0)
            ctx.moveTo(hx, hy);
        else
            ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
    ctx.restore();
}
/**
 * Draws a high-tech gaming progress bar (for XP, ranking, or tournament progress).
 */
export function drawProgressBar(ctx, x, y, width, height, progress, // 0.0 to 1.0
options = {}) {
    const { fillColor = BRAND_COLORS.secondaryCyan, glowColor = BRAND_COLORS.secondaryCyanGlow, bgColor = "#0F141C", borderColor = BRAND_COLORS.borderDark, radius = 4 } = options;
    const clamped = Math.max(0, Math.min(1, progress));
    const fillWidth = Math.max(0, width * clamped);
    ctx.save();
    // Background track
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    ctx.stroke();
    // Fill bar
    if (fillWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, fillWidth, height, radius);
        ctx.clip();
        const barGrad = ctx.createLinearGradient(x, y, x + width, y);
        barGrad.addColorStop(0, BRAND_COLORS.primaryPurpleBright);
        barGrad.addColorStop(1, fillColor);
        ctx.fillStyle = barGrad;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.fillRect(x, y, fillWidth, height);
        ctx.restore();
    }
    ctx.restore();
}
/**
 * Draws an achievement/tier badge.
 */
export function drawBadge(ctx, x, y, radius, tier, label) {
    const badgeConfig = BADGE_TIERS[tier] || BADGE_TIERS.bronze;
    // Hexagon background
    drawHexagon(ctx, x, y, radius, badgeConfig.color, badgeConfig.bg, 2.5);
    // Label inside
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(radius * 0.45)}px sans-serif`;
    ctx.fillStyle = badgeConfig.color;
    ctx.shadowColor = badgeConfig.glow;
    ctx.shadowBlur = 6;
    ctx.fillText(label.slice(0, 3).toUpperCase(), x, y);
    ctx.restore();
}
/**
 * Draws an avatar with dual-ring glowing borders, falling back gracefully to initials.
 */
export async function drawAvatar(ctx, avatarSource, x, y, radius, fallbackInitials = "GS", options = {}) {
    const { shape = "circle", borderColor = BRAND_COLORS.secondaryCyan, glowColor = BRAND_COLORS.secondaryCyanGlow, borderWidth = 3 } = options;
    let loadedImage = null;
    if (avatarSource) {
        try {
            loadedImage = await loadImage(avatarSource);
        }
        catch {
            loadedImage = null;
        }
    }
    ctx.save();
    // Glow ring
    ctx.save();
    ctx.beginPath();
    if (shape === "circle") {
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    }
    else {
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const hx = x + (radius + 2) * Math.cos(angle);
            const hy = y + (radius + 2) * Math.sin(angle);
            if (i === 0)
                ctx.moveTo(hx, hy);
            else
                ctx.lineTo(hx, hy);
        }
        ctx.closePath();
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
    // Clip content area
    ctx.beginPath();
    if (shape === "circle") {
        ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
    else {
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const hx = x + radius * Math.cos(angle);
            const hy = y + radius * Math.sin(angle);
            if (i === 0)
                ctx.moveTo(hx, hy);
            else
                ctx.lineTo(hx, hy);
        }
        ctx.closePath();
    }
    ctx.clip();
    if (loadedImage) {
        ctx.drawImage(loadedImage, x - radius, y - radius, radius * 2, radius * 2);
    }
    else {
        // Fallback: Tech avatar with monogram
        const grad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
        grad.addColorStop(0, "#1F1235");
        grad.addColorStop(1, "#0A2239");
        ctx.fillStyle = grad;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        ctx.fillStyle = BRAND_COLORS.textPrimary;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${Math.round(radius * 0.75)}px sans-serif`;
        ctx.fillText(fallbackInitials.slice(0, 2).toUpperCase(), x, y);
    }
    ctx.restore();
}
// Standard RGB 3-3-2 256-color palette for fast O(1) GIF quantization
const DEFAULT_GIF_PALETTE = [];
for (let i = 0; i < 256; i++) {
    const r = i & 0xe0;
    const g = (i & 0x1c) << 3;
    const b = (i & 0x03) << 6;
    DEFAULT_GIF_PALETTE.push((r << 16) | (g << 8) | b);
}
/**
 * Encodes multiple canvas frames into an animated GIF buffer using pure JavaScript omggif.
 */
export function encodeAnimatedGif(canvases, width, height, delayCentiseconds = 15) {
    const buffer = Buffer.alloc(width * height * canvases.length + 4096);
    const gifWriter = new GifWriter(buffer, width, height, {
        loop: 0,
        palette: DEFAULT_GIF_PALETTE
    });
    const totalPixels = width * height;
    const indexedFrame = new Uint8Array(totalPixels);
    for (const canvas of canvases) {
        const ctx = canvas.getContext("2d");
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        // Convert RGBA to 3-3-2 indexed pixels
        for (let i = 0; i < totalPixels; i++) {
            const offset = i * 4;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            indexedFrame[i] = (r & 0xe0) | ((g & 0xe0) >> 3) | ((b & 0xc0) >> 6);
        }
        gifWriter.addFrame(0, 0, width, height, indexedFrame, {
            delay: delayCentiseconds
        });
    }
    const end = gifWriter.end();
    return buffer.subarray(0, end);
}
//# sourceMappingURL=card-renderer.js.map