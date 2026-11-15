import {Constants} from '@babylonjs/core/Engines/constants';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import type {Scene} from '@babylonjs/core/scene';

export const TILE_SIZE = 256;
export const TEXTURE_BUDGET_BYTES = 16 * 1024 * 1024;
export const TILE_BUDGET_BYTES = 6.5 * 1024 * 1024;

export const TILE_FILES = {
  pla: 'textures/pla-layer-256.png',
  paintedSteel: 'textures/painted-steel-256.png',
  bareSteel: 'textures/bare-steel-256.png',
  concrete: 'textures/concrete-256.png',
  galvanized: 'textures/galvanized-256.png',
  cardboard: 'textures/cardboard-256.png',
  wood: 'textures/wood-256.png',
  rubber: 'textures/rubber-256.png',
  hazard: 'textures/hazard-256.png',
  pegboard: 'textures/pegboard-256.png',
  fabric: 'textures/fabric-256.png',
  safetyMesh: 'textures/safety-mesh-256.png',
} as const;

export type TileName = keyof typeof TILE_FILES;

// The printed hand parts carry real UV unwraps from the Blender pipeline, so
// they sample one photo-generated filament detail map instead of a repeating
// tile. It is neutral grey on purpose: the filament palette does the colour.
export const HAND_TEXTURE_FILE = 'textures/filament-512.png';
export const HAND_TEXTURE_SIZE = 512;

// Equirectangular hall vista painted on the far stage wall: the endless
// factory floor beyond the fogged end of the hall.
export const PANORAMA_FILE = 'textures/hall-vista.png';

export type TileOptions = {
  uScale?: number;
  vScale?: number;
  offsetSeed?: string;
};

export type TextureStats = {
  count: number;
  bytes: number;
  tiles: number;
  tileBytes: number;
  overBudget: boolean;
  overTileBudget: boolean;
};

const tileCache = new WeakMap<Scene, Map<string, Texture>>();

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function tileKey(name: TileName, options: TileOptions): string {
  return [
    name,
    options.uScale ?? 1,
    options.vScale ?? 1,
  ].join(':');
}

export function tileTexture(
    scene: Scene,
    name: TileName,
    options: TileOptions = {},
): Texture {
  const key = tileKey(name, options);
  let cache = tileCache.get(scene);
  if (!cache) {
    cache = new Map();
    tileCache.set(scene, cache);
  }
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }
  const texture = new Texture(TILE_FILES[name], scene, {
    noMipmap: false,
    invertY: false,
    samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
  });
  texture.name = `tile:${name}:${key}`;
  texture.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
  texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
  texture.uScale = options.uScale ?? 1;
  texture.vScale = options.vScale ?? 1;
  const seed = hash(options.offsetSeed ?? name);
  texture.uOffset = (seed & 0xffff) / 0xffff;
  texture.vOffset = ((seed >>> 16) & 0xffff) / 0xffff;
  texture.anisotropicFilteringLevel = 8;
  cache.set(key, texture);
  return texture;
}

export function applyTile(
    material: StandardMaterial,
    scene: Scene,
    name: TileName,
    options: TileOptions = {},
): Texture {
  const texture = tileTexture(scene, name, options);
  material.diffuseTexture = texture;
  return texture;
}

const handTextures = new WeakMap<Scene, Texture>();

// One instance per scene: the three palette materials share the upload and
// differ only in the diffuse tint they multiply it by.
export function handTexture(scene: Scene): Texture {
  const existing = handTextures.get(scene);
  if (existing) {
    return existing;
  }
  const texture = new Texture(HAND_TEXTURE_FILE, scene, {
    noMipmap: false,
    invertY: false,
    samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
  });
  texture.name = 'hand:filament';
  texture.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
  texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
  handTextures.set(scene, texture);
  return texture;
}

export function tiledMaterial(
    scene: Scene,
    name: string,
    tile: TileName,
    options: TileOptions = {},
): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) {
    return existing;
  }
  const material = new StandardMaterial(name, scene);
  applyTile(material, scene, tile, options);
  material.specularColor.set(0.05, 0.05, 0.06);
  return material;
}

export function textureStats(scene: Scene): TextureStats {
  let count = 0;
  let bytes = 0;
  let tiles = 0;
  let tileBytes = 0;
  for (const texture of scene.textures) {
    if (!(texture instanceof Texture) || texture.isRenderTarget) {
      continue;
    }
    // GUI canvases are sized by the display or by the panel they wrap, not
    // by the art this budget guards, so they are counted separately.
    if (texture.getClassName() === 'AdvancedDynamicTexture') {
      continue;
    }
    count++;
    const size = texture.getSize();
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    const textureBytes = Math.round(width * height * 4 * 1.34);
    bytes += textureBytes;
    if (width <= TILE_SIZE && height <= TILE_SIZE) {
      tiles++;
      tileBytes += textureBytes;
    }
  }
  return {
    count,
    bytes,
    tiles,
    tileBytes,
    overBudget: bytes > TEXTURE_BUDGET_BYTES,
    overTileBudget: tileBytes > TILE_BUDGET_BYTES,
  };
}
