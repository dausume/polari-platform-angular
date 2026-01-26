// Color utility functions for the no-code visual programming system

/**
 * Convert hex color to RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Handle 3-character hex
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate relative luminance of a color (0-1 scale)
 * Based on WCAG 2.0 formula
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Get a contrasting text color (black or white) for a given background color
 * Uses WCAG luminance calculation for accessibility
 */
export function getContrastingTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) {
    // Default to black text if color can't be parsed
    return '#000000';
  }

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  // Use white text on dark backgrounds, black on light
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

/**
 * Default slot colors
 */
export const DEFAULT_INPUT_SLOT_COLOR = '#4CAF50';  // Green
export const DEFAULT_OUTPUT_SLOT_COLOR = '#2196F3'; // Blue

/**
 * Generate slot label based on type and index
 * Inputs: I0, I1, I2...
 * Outputs: O0, O1, O2...
 */
export function generateSlotLabel(isInput: boolean, index: number): string {
  return isInput ? `I${index}` : `O${index}`;
}
