import { SKRSContext2D, Canvas } from "@napi-rs/canvas";
import { BadgeTier } from "../identity/design-tokens.js";
export type TextAlign = "left" | "right" | "center" | "start" | "end";
export type TextBaseline = "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
export interface GlowTextOptions {
    font?: string;
    color?: string;
    glowColor?: string;
    glowBlur?: number;
    align?: TextAlign;
    baseline?: TextBaseline;
}
export interface BackgroundOptions {
    primaryAccent?: string;
    secondaryAccent?: string;
    gridOpacity?: number;
    showScanlines?: boolean;
    scanlineOffset?: number;
    glitchSlice?: boolean;
}
export interface ProgressBarOptions {
    fillColor?: string;
    glowColor?: string;
    bgColor?: string;
    borderColor?: string;
    radius?: number;
}
export interface AvatarDrawOptions {
    shape?: "circle" | "hexagon";
    borderColor?: string;
    glowColor?: string;
    borderWidth?: number;
}
/**
 * Creates a canvas with high-dpi-safe rendering context.
 */
export declare function createBaseCanvas(width: number, height: number): Canvas;
/**
 * Draws the signature GAMING SHAMING cyberpunk background with dark obsidian gradient,
 * subtle tech grid, diagonal neon corner accents, and vignette.
 */
export declare function drawCyberpunkBackground(ctx: SKRSContext2D, width: number, height: number, options?: BackgroundOptions): void;
/**
 * Draws text with a vibrant neon outer glow.
 */
export declare function drawGlowText(ctx: SKRSContext2D, text: string, x: number, y: number, options?: GlowTextOptions): void;
/**
 * Draws a sharp geometric hexagon (useful for gaming badges and stats).
 */
export declare function drawHexagon(ctx: SKRSContext2D, x: number, y: number, radius: number, strokeColor?: string, fillColor?: string, lineWidth?: number): void;
/**
 * Draws a high-tech gaming progress bar (for XP, ranking, or tournament progress).
 */
export declare function drawProgressBar(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, progress: number, // 0.0 to 1.0
options?: ProgressBarOptions): void;
/**
 * Draws an achievement/tier badge.
 */
export declare function drawBadge(ctx: SKRSContext2D, x: number, y: number, radius: number, tier: BadgeTier, label: string): void;
/**
 * Draws an avatar with dual-ring glowing borders, falling back gracefully to initials.
 */
export declare function drawAvatar(ctx: SKRSContext2D, avatarSource: string | Buffer | null, x: number, y: number, radius: number, fallbackInitials?: string, options?: AvatarDrawOptions): Promise<void>;
/**
 * Encodes multiple canvas frames into an animated GIF buffer using pure JavaScript omggif.
 */
export declare function encodeAnimatedGif(canvases: Canvas[], width: number, height: number, delayCentiseconds?: number): Buffer;
