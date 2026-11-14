#!/usr/bin/env node
// Scene audit: dumps every mesh the finished game draws and checks the things
// a per-feature test cannot see. The game already audits the forklift's sweep
// against walls, racks and robots in layout.ts; this asks the whole scene the
// same question, and writes the dump that tools/blender/build_hall_scene.py
// turns into one editable Blender scene.
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const PREVIEW_TIMEOUT_MS = 60_000;
const BELOW_FLOOR_TOLERANCE = 0.05;
const SHELL_TOLERANCE = 0.06;
const OVERLAP_MIN_M3 = 0.02;
const SUPPORT_GAP = 0.08;

function args() {
  const argv = process.argv.slice(2);
  const get = (flag, fallback) => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : argv[index + 1];
  };
  return {out: resolve(ROOT, get('--out', 'qa-out'))};
}

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function startPreview() {
  const child = spawn(
      process.execPath,
      [
        resolve(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
        'preview',
        '--port', String(PORT),
        '--strictPort',
      ],
      {cwd: ROOT, stdio: 'ignore'},
  );
  const deadline = Date.now() + PREVIEW_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/`);
      if (response.ok) {
        return child;
      }
    } catch {
      // not up yet
    }
    await wait(300);
  }
  child.kill();
  throw new Error(`preview did not start on port ${PORT}`);
}

function group(name) {
  const lower = name.toLowerCase();
  if (lower.startsWith('part:')) return 'hand';
  if (lower.startsWith('handrep')) return 'controllers';
  if (lower.includes('conveyor')) return 'conveyor';
  if (lower.includes('forklift')) return 'forklift';
  if (lower.includes('rack')) return 'rack';
  if (lower.includes('crate') || lower.includes('pallet')) return 'load';
  if (lower.includes('barrier')) return 'barrier';
  if (lower.includes('audience') || lower.includes('chair')) return 'crowd';
  if (lower.includes('robot')) return 'robot';
  if (lower.includes('printer')) return 'printer';
  if (lower.includes('pedestal') || lower.includes('column')) return 'stage';
  if (lower.includes('ground') || lower.includes('floor') ||
      lower.includes('wall') || lower.includes('roof') ||
      lower.includes('pillar') || lower.includes('beam') ||
      lower.includes('sill') || lower.includes('door') ||
      lower.includes('tier') || lower.includes('screen') ||
      lower.includes('stage') || lower.includes('podium') ||
      lower.includes('light') || lower.includes('lamp')) {
    return 'shell';
  }
  return 'misc';
}

function volume(a, b) {
  const dx = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
  const dy = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
  const dz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
  if (dx <= 0 || dy <= 0 || dz <= 0) {
    return 0;
  }
  return dx * dy * dz;
}

function auditScene(meshes) {
  const floor = meshes.find((mesh) => mesh.name === 'ground');
  const report = {floor: null, belowFloor: [], outsideShell: [], overlaps: [],
    unsupported: []};
  if (!floor) {
    return report;
  }
  report.floor = {min: floor.min, max: floor.max};

  for (const mesh of meshes) {
    // The belt runs out of a floor-level feed housing, so its lower length is
    // under the floor on purpose.
    if (mesh.name === 'ground' || mesh.name === 'conveyorBelt') {
      continue;
    }
    if (mesh.max[1] < -BELOW_FLOOR_TOLERANCE) {
      report.belowFloor.push({name: mesh.name, top: round(mesh.max[1])});
    }
    const outside = mesh.min[0] < floor.min[0] - SHELL_TOLERANCE ||
      mesh.max[0] > floor.max[0] + SHELL_TOLERANCE ||
      mesh.min[2] < floor.min[2] - SHELL_TOLERANCE ||
      mesh.max[2] > floor.max[2] + SHELL_TOLERANCE;
    if (outside) {
      report.outsideShell.push({
        name: mesh.name,
        min: mesh.min.map(round),
        max: mesh.max.map(round),
      });
    }
  }

  for (let i = 0; i < meshes.length; i++) {
    for (let j = i + 1; j < meshes.length; j++) {
      const a = meshes[i];
      const b = meshes[j];
      const ga = group(a.name);
      const gb = group(b.name);
      if (ga === gb && ga !== 'misc') {
        continue;
      }
      if (ga === 'shell' || gb === 'shell') {
        continue;
      }
      const shared = volume(a, b);
      if (shared >= OVERLAP_MIN_M3) {
        report.overlaps.push({
          a: a.name,
          b: b.name,
          groups: `${ga}/${gb}`,
          m3: round(shared),
        });
      }
    }
  }
  report.overlaps.sort((a, b) => b.m3 - a.m3);
  report.overlaps = report.overlaps.slice(0, 25);

  for (const mesh of meshes) {
    if (group(mesh.name) !== 'load' || mesh.min[1] < 0.08) {
      continue;
    }
    const supported = meshes.some((other) => {
      if (other === mesh) {
        return false;
      }
      const under = other.max[1] <= mesh.min[1] + SUPPORT_GAP &&
        other.max[1] >= mesh.min[1] - SUPPORT_GAP;
      const across = other.min[0] < mesh.max[0] && other.max[0] > mesh.min[0] &&
        other.min[2] < mesh.max[2] && other.max[2] > mesh.min[2];
      return under && across;
    });
    if (!supported) {
      report.unsupported.push({name: mesh.name, base: round(mesh.min[1])});
    }
  }
  return report;
}

function round(value) {
  return Number(value.toFixed(3));
}

async function main() {
  const options = args();
  const server = await startPreview();
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 540}});
    await page.goto(`${BASE}/`, {waitUntil: 'load'});
    await page.waitForFunction(() => window.factoryDebug !== undefined,
        undefined, {timeout: 120_000});
    // Audit the finished build: every part placed, nothing left on the belt.
    await page.evaluate(() => window.factoryDebug.completeHand());
    await page.waitForTimeout(2500);
    const meshes = await page.evaluate(
        () => window.factoryDebug.sceneDump());
    const perf = await page.evaluate(() => window.factoryDebug.perf());
    const audit = auditScene(meshes);
    const totalTris = meshes.reduce((sum, mesh) => sum + mesh.tris, 0);
    const byGroup = new Map();
    for (const mesh of meshes) {
      const key = group(mesh.name);
      const entry = byGroup.get(key) ?? {meshes: 0, tris: 0};
      entry.meshes += 1;
      entry.tris += mesh.tris;
      byGroup.set(key, entry);
    }

    const obj = await page.evaluate(() => window.factoryDebug.sceneObj());
    await mkdir(options.out, {recursive: true});
    await writeFile(resolve(options.out, 'scene.json'),
        `${JSON.stringify({generatedAt: new Date().toISOString(), meshes},
            null, 1)}\n`);
    await writeFile(resolve(options.out, 'scene.obj'), `${obj}\n`);

    console.log(`scene    ${meshes.length} meshes, ${totalTris} tris, ` +
      `${perf.materials} materials, ${perf.activeMeshes} active`);
    for (const [key, entry] of [...byGroup.entries()]
        .sort((a, b) => b[1].tris - a[1].tris)) {
      console.log(`  ${key.padEnd(10)} ${String(entry.meshes).padStart(4)} ` +
        `meshes ${String(entry.tris).padStart(7)} tris`);
    }
    const heavy = [...meshes].sort((a, b) => b.tris - a.tris).slice(0, 6);
    console.log('heaviest  ' + heavy.map((mesh) =>
      `${mesh.name} ${mesh.tris}`).join(', '));

    console.log(`below    ${audit.belowFloor.length} meshes under the floor`);
    for (const entry of audit.belowFloor.slice(0, 8)) {
      console.log(`  ${entry.name} top=${entry.top}`);
    }
    console.log(`outside  ${audit.outsideShell.length} meshes outside the ` +
      'floor plate');
    for (const entry of audit.outsideShell.slice(0, 8)) {
      console.log(`  ${entry.name} min=${entry.min} max=${entry.max}`);
    }
    console.log(`overlap  ${audit.overlaps.length} prop pairs intersect`);
    for (const entry of audit.overlaps) {
      console.log(`  ${entry.m3.toFixed(3)} m3 ${entry.groups.padEnd(20)} ` +
        `${entry.a} x ${entry.b}`);
    }
    console.log(`support  ${audit.unsupported.length} lifted loads with ` +
      'nothing under them');
    for (const entry of audit.unsupported.slice(0, 8)) {
      console.log(`  ${entry.name} base=${entry.base}`);
    }

    await writeFile(resolve(options.out, 'scene-audit.json'),
        `${JSON.stringify({generatedAt: new Date().toISOString(),
          totalTris, perf, audit}, null, 2)}\n`);
    process.exitCode = audit.belowFloor.length || audit.outsideShell.length ?
      1 : 0;
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(`scene audit failed: ${error.message}`);
  process.exitCode = 1;
});
