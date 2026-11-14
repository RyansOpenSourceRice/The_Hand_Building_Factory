#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = resolve(HERE, '..', 'public', 'models', 'hand');

// A screw head sits on the surface, so an anchor should touch its part. The
// tolerance allows for float rounding in the export.
const ON_SURFACE_MM = 0.5;

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error('not a GLB');
  }
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const chunk = buffer.subarray(start, start + length);
    if (type === 0x4e4f534a) {
      json = JSON.parse(chunk.toString('utf8'));
    } else if (type === 0x004e4942) {
      bin = chunk;
    }
    offset = start + length;
  }
  if (!json) {
    throw new Error('GLB has no JSON chunk');
  }
  return {json, bin};
}

function readVec3(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView];
  const stride = view.byteStride ?? 12;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out = [];
  for (let i = 0; i < accessor.count; i++) {
    const at = base + i * stride;
    out.push([
      glb.bin.readFloatLE(at),
      glb.bin.readFloatLE(at + 4),
      glb.bin.readFloatLE(at + 8),
    ]);
  }
  return out;
}

function readIndices(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView];
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out = [];
  for (let i = 0; i < accessor.count; i++) {
    if (accessor.componentType === 5125) {
      out.push(glb.bin.readUInt32LE(base + i * 4));
    } else if (accessor.componentType === 5123) {
      out.push(glb.bin.readUInt16LE(base + i * 2));
    } else {
      out.push(glb.bin.readUInt8(base + i));
    }
  }
  return out;
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length(a) {
  return Math.sqrt(dot(a, a));
}

function pointTriangleDistance(p, a, b, c) {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const ap = subtract(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) {
    return length(ap);
  }
  const bp = subtract(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) {
    return length(bp);
  }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return length(subtract(p, [a[0] + ab[0] * v, a[1] + ab[1] * v,
      a[2] + ab[2] * v]));
  }
  const cp = subtract(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) {
    return length(cp);
  }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return length(subtract(p, [a[0] + ac[0] * w, a[1] + ac[1] * w,
      a[2] + ac[2] * w]));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    const bc = subtract(c, b);
    return length(subtract(p, [b[0] + bc[0] * w, b[1] + bc[1] * w,
      b[2] + bc[2] * w]));
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return length(subtract(p, [
    a[0] + ab[0] * v + ac[0] * w,
    a[1] + ab[1] * v + ac[1] * w,
    a[2] + ab[2] * v + ac[2] * w,
  ]));
}

async function main() {
  const manifest = JSON.parse(
      await readFile(resolve(MODEL_DIR, 'parts.json'), 'utf8'),
  );
  const failures = [];
  const report = [];

  for (const [id, part] of Object.entries(manifest.parts)) {
    const glb = parseGlb(await readFile(resolve(MODEL_DIR, part.glb)));
    const primitive = glb.json.meshes[0].primitives[0];
    const positions = readVec3(glb, primitive.attributes.POSITION);
    const indices = primitive.indices === undefined ?
      positions.map((_, index) => index) :
      readIndices(glb, primitive.indices);
    const hasUvs = primitive.attributes.TEXCOORD_0 !== undefined;

    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of positions) {
      minY = Math.min(minY, point[1]);
      maxY = Math.max(maxY, point[1]);
    }

    if (!hasUvs) {
      failures.push(`${id}: no TEXCOORD_0 (small-texture plan needs UVs)`);
    }
    if (indices.length / 3 > part.tris + 2) {
      failures.push(
          `${id}: ${indices.length / 3} triangles exceeds reported ` +
          `${part.tris}`,
      );
    }

    let worstMm = 0;
    let weakestOutward = Infinity;
    for (const anchor of part.anchors) {
      const point = anchor.point;
      const normal = anchor.normal;
      let nearest = Infinity;
      let nearestIndex = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const distance = pointTriangleDistance(
            point,
            positions[indices[i]],
            positions[indices[i + 1]],
            positions[indices[i + 2]],
        );
        if (distance < nearest) {
          nearest = distance;
          nearestIndex = i;
        }
      }
      worstMm = Math.max(worstMm, nearest * 1000);
      if (nearest * 1000 > ON_SURFACE_MM) {
        failures.push(
            `${id}: anchor ${point} sits ${(nearest * 1000).toFixed(2)} mm ` +
            'off the surface',
        );
      }
      // Compare against the normal of the triangle actually touched. A
      // centroid-based test is wrong for concave shells such as the palm.
      const a = positions[indices[nearestIndex]];
      const b = positions[indices[nearestIndex + 1]];
      const c = positions[indices[nearestIndex + 2]];
      const faceNormal = cross(subtract(b, a), subtract(c, a));
      const magnitude = length(faceNormal);
      const aligned = magnitude > 0 ?
        dot(normal, faceNormal) / magnitude : 0;
      weakestOutward = Math.min(weakestOutward, aligned);
      if (aligned < 0.9) {
        failures.push(
            `${id}: anchor ${point} normal disagrees with its surface ` +
            `(${aligned.toFixed(2)})`,
        );
      }
      if (point[1] < minY - 0.001 || point[1] > maxY + 0.001) {
        failures.push(`${id}: anchor ${point} outside the part bounds`);
      }
    }
    report.push({
      id,
      tris: indices.length / 3,
      uvs: hasUvs,
      anchors: part.anchors.length,
      worstMm: Number(worstMm.toFixed(3)),
      weakestOutward: Number(weakestOutward.toFixed(2)),
    });
  }

  for (const row of report) {
    console.log(
        `ok ${row.id.padEnd(16)} tris=${String(row.tris).padStart(5)} ` +
        `uvs=${row.uvs ? 'y' : 'n'} anchors=${row.anchors} ` +
        `off=${row.worstMm}mm outward=${row.weakestOutward}`,
    );
  }
  if (failures.length) {
    for (const failure of failures) {
      console.log(`FAIL ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  const total = report.reduce((sum, row) => sum + row.tris, 0);
  console.log(`geometry ok: ${report.length} parts, ${total} triangles`);
}

main().catch((error) => {
  console.error(`validate-hand failed: ${error.message}`);
  process.exitCode = 1;
});
