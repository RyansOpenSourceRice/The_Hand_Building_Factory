import {Constants} from '@babylonjs/core/Engines/constants';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {VertexBuffer} from '@babylonjs/core/Buffers/buffer';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
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
  const texture = new Texture(TILE_FILES[name], scene, true, false,
      Texture.TRILINEAR_SAMPLINGMODE);
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

export function ensurePlanarUVs(
    mesh: Mesh,
    uScale = 18,
    vScale = 55,
): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions || positions.length < 3) {
    return;
  }
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let i = 0, v = 0; i < positions.length; i += 3, v += 2) {
    const x = positions[i] ?? 0;
    const y = positions[i + 1] ?? 0;
    const z = positions[i + 2] ?? 0;
    uvs[v] = (x + z) * uScale;
    uvs[v + 1] = y * vScale;
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs, false, 2);
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
