/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - ThreeSimSpaceRenderer (via buildMaterial's texture argument)
 * @see /OVERLAP_MAP.md
 *
 * Three.js texture builders: Texture3DDef → THREE.Texture. Procedural
 * kinds render onto a canvas (self-contained — no asset fetching, so
 * they travel in module bundles as pure config); the 'image' source is
 * the file-store knob — its URL plumbing is isolated in
 * `fileStoreTextureUrl` so wiring MinIO later is a single-touch change.
 *
 * Textures are cached by definition name — they are immutable rows, and
 * THREE.Texture instances are shareable across materials/meshes.
 */

import * as THREE from 'three';

import { Texture3DDef } from './texture-3d-library.service';

const TEXTURE_SIZE = 256;

const textureCache = new Map<string, THREE.Texture>();

/** Test/HMR hook — drops all cached textures (does not dispose GPU
 *  resources of textures still referenced by live materials). */
export function clearTextureCache(): void {
  textureCache.clear();
}

export function buildTexture(def: Texture3DDef | undefined): THREE.Texture | null {
  if (!def?.name) return null;
  const cached = textureCache.get(def.name);
  if (cached) return cached;

  let texture: THREE.Texture | null = null;
  if (def.source === 'image') {
    const url = fileStoreTextureUrl(def);
    if (url) texture = new THREE.TextureLoader().load(url);
  } else {
    const canvas = renderProceduralCanvas(def);
    if (canvas) {
      texture = new THREE.CanvasTexture(canvas);
    }
  }
  if (!texture) return null;

  texture.wrapS = wrapMode(def.wrap_s);
  texture.wrapT = wrapMode(def.wrap_t);
  texture.repeat.set(def.repeat_u || 1, def.repeat_v || 1);
  texture.offset.set(def.offset_u || 0, def.offset_v || 0);
  texture.rotation = def.rotation || 0;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(def.name, texture);
  return texture;
}

/** The 'image' source's URL — file-store (MinIO) plumbing lands here
 *  and nowhere else. Returns null until that knob is wired. */
function fileStoreTextureUrl(def: Texture3DDef): string | null {
  if (!def.s3_bucket || !def.s3_object_key) return null;
  console.warn(
    `[three-texture-builders] image texture '${def.name}' declared but the `
    + 'file-store URL plumbing is not wired yet (procedural-first phase).');
  return null;
}

function wrapMode(mode: string): THREE.Wrapping {
  switch (mode) {
    case 'clamp': return THREE.ClampToEdgeWrapping;
    case 'mirror': return THREE.MirroredRepeatWrapping;
    default: return THREE.RepeatWrapping;
  }
}

// ---------------------------------------------------------------------------
// Procedural generators — deterministic per definition (seeded noise).
// ---------------------------------------------------------------------------

interface ProceduralParams {
  colorA?: string;
  colorB?: string;
  cells?: number;
  stripes?: number;
  scale?: number;
  seed?: number;
  /** gradient direction: 'vertical' | 'horizontal'. */
  direction?: string;
}

function renderProceduralCanvas(def: Texture3DDef): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let params: ProceduralParams = {};
  try {
    params = JSON.parse(def.procedural_params_json || '{}');
  } catch { /* defaults below */ }
  const colorA = params.colorA || '#ffffff';
  const colorB = params.colorB || '#cccccc';

  switch (def.procedural_kind) {
    case 'checker': drawChecker(ctx, colorA, colorB, params.cells ?? 8); break;
    case 'stripes': drawStripes(ctx, colorA, colorB, params.stripes ?? 24); break;
    case 'gradient': drawGradient(ctx, colorA, colorB, params.direction); break;
    case 'noise':
    default:
      drawNoise(ctx, colorA, colorB, params.scale ?? 32, params.seed ?? 1);
      break;
  }
  return canvas;
}

function drawChecker(ctx: CanvasRenderingContext2D, a: string, b: string,
                     cells: number): void {
  const size = TEXTURE_SIZE / Math.max(1, cells);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
      ctx.fillRect(x * size, y * size, size, size);
    }
  }
}

function drawStripes(ctx: CanvasRenderingContext2D, a: string, b: string,
                     stripes: number): void {
  const width = TEXTURE_SIZE / Math.max(1, stripes);
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? a : b;
    ctx.fillRect(i * width, 0, width, TEXTURE_SIZE);
  }
}

function drawGradient(ctx: CanvasRenderingContext2D, a: string, b: string,
                      direction?: string): void {
  const gradient = direction === 'horizontal'
    ? ctx.createLinearGradient(0, 0, TEXTURE_SIZE, 0)
    : ctx.createLinearGradient(0, 0, 0, TEXTURE_SIZE);
  gradient.addColorStop(0, a);
  gradient.addColorStop(1, b);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
}

/** Value noise on a coarse grid, bilinearly sampled — smooth blotches
 *  between the two colors. Deterministic via a tiny seeded PRNG (the
 *  same definition always renders the same texture). */
function drawNoise(ctx: CanvasRenderingContext2D, a: string, b: string,
                   scale: number, seed: number): void {
  const grid = Math.max(2, Math.min(128, Math.round(scale)));
  const rand = mulberry32(seed);
  const values: number[][] = [];
  for (let y = 0; y <= grid; y++) {
    values.push(Array.from({ length: grid + 1 }, () => rand()));
  }
  const colorA = parseColor(ctx, a);
  const colorB = parseColor(ctx, b);
  const image = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  for (let py = 0; py < TEXTURE_SIZE; py++) {
    const gy = (py / TEXTURE_SIZE) * grid;
    const y0 = Math.floor(gy), ty = gy - y0;
    for (let px = 0; px < TEXTURE_SIZE; px++) {
      const gx = (px / TEXTURE_SIZE) * grid;
      const x0 = Math.floor(gx), tx = gx - x0;
      const v =
        values[y0][x0] * (1 - tx) * (1 - ty)
        + values[y0][x0 + 1] * tx * (1 - ty)
        + values[y0 + 1][x0] * (1 - tx) * ty
        + values[y0 + 1][x0 + 1] * tx * ty;
      const i = (py * TEXTURE_SIZE + px) * 4;
      image.data[i] = colorA[0] * (1 - v) + colorB[0] * v;
      image.data[i + 1] = colorA[1] * (1 - v) + colorB[1] * v;
      image.data[i + 2] = colorA[2] * (1 - v) + colorB[2] * v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function parseColor(ctx: CanvasRenderingContext2D,
                    css: string): [number, number, number] {
  ctx.fillStyle = css;
  const hex = String(ctx.fillStyle);
  if (hex.startsWith('#') && hex.length === 7) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)];
  }
  return [255, 255, 255];
}

/** Tiny deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
