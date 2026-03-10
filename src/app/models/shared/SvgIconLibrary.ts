/**
 * Where the marker anchor point attaches to the geographic coordinate.
 * - 'center': The center of the SVG aligns with the point
 * - 'bottom': The bottom-center of the SVG aligns with the point (typical for pin markers)
 */
export type IconAnchor = 'center' | 'bottom';

/**
 * A named SVG icon definition.
 * Shared across the platform — used by action buttons, map markers, and other components.
 * Icons are pure SVG strings with no styling — styling comes from SvgIconStyle.
 */
export interface SvgIconDef {
  name: string;
  label: string;
  svgString: string;
  category: 'action' | 'status' | 'data' | 'navigation' | 'media' | 'marker';
}

/**
 * A named style definition that can be applied to any SVG icon.
 * Shared across maps (markers) and table action buttons.
 */
export interface SvgIconStyle {
  name: string;
  label: string;
  width: number;
  height: number;
  anchor: IconAnchor;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

/**
 * Built-in SVG icon library.
 * These icons are available system-wide for action buttons, map markers, etc.
 */
export const BUILT_IN_SVG_ICONS: SvgIconDef[] = [
  // --- Action icons ---
  {
    name: 'play',
    label: 'Play',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>'
  },
  {
    name: 'stop',
    label: 'Stop',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="12" height="12" fill="currentColor"/></svg>'
  },
  {
    name: 'pause',
    label: 'Pause',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>'
  },
  {
    name: 'refresh',
    label: 'Refresh',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.65 6.35A7.96 7.96 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>'
  },
  {
    name: 'send',
    label: 'Send',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>'
  },
  {
    name: 'download',
    label: 'Download',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>'
  },
  {
    name: 'upload',
    label: 'Upload',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" fill="currentColor"/></svg>'
  },
  {
    name: 'sync',
    label: 'Sync',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="currentColor"/></svg>'
  },
  {
    name: 'bolt',
    label: 'Lightning',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z" fill="currentColor"/></svg>'
  },
  {
    name: 'rocket',
    label: 'Rocket',
    category: 'action',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5c0 0-5 4.5-5 11.5 0 2 .5 3.5 1 4.5l1.5-1.5c-.3-.8-.5-1.8-.5-3 0-5.5 3-9 3-9s3 3.5 3 9c0 1.2-.2 2.2-.5 3L16 18.5c.5-1 1-2.5 1-4.5 0-7-5-11.5-5-11.5zM12 16a2 2 0 100-4 2 2 0 000 4zM7 20.5l2-2c-.5-.3-.8-.7-1-1.2L5.5 20l1.5.5zM17 20.5L15 18.5c.5-.3.8-.7 1-1.2l2.5 2.7-1.5.5z" fill="currentColor"/></svg>'
  },

  // --- Status icons ---
  {
    name: 'check-circle',
    label: 'Check Circle',
    category: 'status',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>'
  },
  {
    name: 'warning',
    label: 'Warning',
    category: 'status',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/></svg>'
  },
  {
    name: 'info',
    label: 'Info',
    category: 'status',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/></svg>'
  },
  {
    name: 'error',
    label: 'Error',
    category: 'status',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" fill="currentColor"/></svg>'
  },

  // --- Data icons ---
  {
    name: 'analytics',
    label: 'Analytics',
    category: 'data',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill="currentColor"/></svg>'
  },
  {
    name: 'export',
    label: 'Export',
    category: 'data',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" fill="currentColor"/></svg>'
  },
  {
    name: 'filter',
    label: 'Filter',
    category: 'data',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" fill="currentColor"/></svg>'
  },
  {
    name: 'table',
    label: 'Table',
    category: 'data',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h18v18H3V3zm2 2v4h6V5H5zm8 0v4h6V5h-6zm-8 6v4h6v-4H5zm8 0v4h6v-4h-6zm-8 6v4h6v-4H5zm8 0v4h6v-4h-6z" fill="currentColor"/></svg>'
  },

  // --- Navigation icons ---
  {
    name: 'link',
    label: 'Link',
    category: 'navigation',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="currentColor"/></svg>'
  },
  {
    name: 'open-external',
    label: 'Open External',
    category: 'navigation',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" fill="currentColor"/></svg>'
  },

  // --- Marker icons ---
  {
    name: 'pin',
    label: 'Map Pin',
    category: 'marker',
    svgString: '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="currentColor"/><circle cx="12" cy="12" r="5" fill="white"/></svg>'
  },
  {
    name: 'dot',
    label: 'Dot',
    category: 'marker',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="currentColor" stroke="white" stroke-width="2"/></svg>'
  },
  {
    name: 'star',
    label: 'Star',
    category: 'marker',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/></svg>'
  },
  {
    name: 'diamond',
    label: 'Diamond',
    category: 'marker',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 12l10 10 10-10L12 2z" fill="currentColor"/></svg>'
  },
  {
    name: 'square',
    label: 'Square',
    category: 'marker',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/></svg>'
  },
  {
    name: 'triangle',
    label: 'Triangle',
    category: 'marker',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3L2 21h20L12 3z" fill="currentColor"/></svg>'
  },
  {
    name: 'flag',
    label: 'Flag',
    category: 'marker',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" fill="currentColor"/></svg>'
  },
  {
    name: 'crosshair',
    label: 'Crosshair',
    category: 'marker',
    svgString: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="currentColor"/></svg>'
  }
];

/**
 * Built-in SVG icon styles.
 * These styles can be applied to any icon for consistent sizing and coloring.
 */
export const BUILT_IN_SVG_STYLES: SvgIconStyle[] = [
  {
    name: 'default-pin',
    label: 'Default Pin',
    width: 24,
    height: 36,
    anchor: 'bottom',
    fillColor: '#3f51b5',
    strokeColor: '#1a237e',
    strokeWidth: 1
  },
  {
    name: 'small-dot',
    label: 'Small Dot',
    width: 16,
    height: 16,
    anchor: 'center',
    fillColor: '#1976d2',
    strokeColor: '#ffffff',
    strokeWidth: 2
  },
  {
    name: 'medium-marker',
    label: 'Medium Marker',
    width: 24,
    height: 24,
    anchor: 'center',
    fillColor: '#388e3c',
    strokeColor: '#1b5e20',
    strokeWidth: 1
  },
  {
    name: 'large-marker',
    label: 'Large Marker',
    width: 32,
    height: 32,
    anchor: 'center',
    fillColor: '#d32f2f',
    strokeColor: '#b71c1c',
    strokeWidth: 1.5
  },
  {
    name: 'large-pin',
    label: 'Large Pin',
    width: 32,
    height: 48,
    anchor: 'bottom',
    fillColor: '#e91e63',
    strokeColor: '#880e4f',
    strokeWidth: 1
  },
  {
    name: 'warning-marker',
    label: 'Warning Marker',
    width: 28,
    height: 28,
    anchor: 'center',
    fillColor: '#ff9800',
    strokeColor: '#e65100',
    strokeWidth: 1.5
  },
  {
    name: 'subtle-marker',
    label: 'Subtle Marker',
    width: 20,
    height: 20,
    anchor: 'center',
    fillColor: '#78909c',
    strokeColor: '#455a64',
    strokeWidth: 0.5
  },
  {
    name: 'button-icon',
    label: 'Button Icon',
    width: 20,
    height: 20,
    anchor: 'center',
    fillColor: 'currentColor',
    strokeColor: 'none',
    strokeWidth: 0
  }
];

/**
 * Get all available SVG icons.
 */
export function getAllSvgIcons(): SvgIconDef[] {
  return BUILT_IN_SVG_ICONS;
}

/**
 * Get an SVG icon by name.
 */
export function getSvgIcon(name: string): SvgIconDef | undefined {
  return BUILT_IN_SVG_ICONS.find(icon => icon.name === name);
}

/**
 * Get SVG icons filtered by category.
 */
export function getSvgIconsByCategory(category: SvgIconDef['category']): SvgIconDef[] {
  return BUILT_IN_SVG_ICONS.filter(icon => icon.category === category);
}

/**
 * Get all icon category names.
 */
export function getSvgIconCategories(): string[] {
  return [...new Set(BUILT_IN_SVG_ICONS.map(icon => icon.category))];
}

/**
 * Get all available SVG icon styles.
 */
export function getAllSvgStyles(): SvgIconStyle[] {
  return BUILT_IN_SVG_STYLES;
}

/**
 * Get an SVG icon style by name.
 */
export function getSvgStyle(name: string): SvgIconStyle | undefined {
  return BUILT_IN_SVG_STYLES.find(style => style.name === name);
}

/**
 * Apply a style to an SVG string, returning the styled SVG markup.
 * Replaces fill/stroke on shape elements, preserving white/none fills.
 */
export function applyStyleToSvg(svgString: string, style: SvgIconStyle): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.documentElement;
    const elements = svg.querySelectorAll('path, circle, rect, polygon, ellipse');
    elements.forEach((el: Element) => {
      const currentFill = el.getAttribute('fill');
      if (currentFill !== 'white' && currentFill !== 'none' && currentFill !== '#ffffff' && currentFill !== '#fff') {
        el.setAttribute('fill', style.fillColor);
      }
      if (style.strokeColor !== 'none') {
        el.setAttribute('stroke', style.strokeColor);
        el.setAttribute('stroke-width', String(style.strokeWidth));
      }
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return svgString;
  }
}

/**
 * Resolve an icon + style combination into a fully styled SVG string.
 */
export function resolveStyledIcon(iconName: string, styleName: string): { svgString: string; style: SvgIconStyle } | null {
  const icon = getSvgIcon(iconName);
  const style = getSvgStyle(styleName);
  if (!icon || !style) return null;
  return {
    svgString: applyStyleToSvg(icon.svgString, style),
    style
  };
}
