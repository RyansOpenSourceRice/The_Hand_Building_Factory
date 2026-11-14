#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {chromium} from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, 'qa-mcp-server.mjs');
const CALL_TIMEOUT_MS = 240_000;
const BLANK_SHOT_BYTES = 20_000;

// Each session owns its own port, so agents can run side by side.
function parseArgs(argv) {
  const options = {
    views: ['front', 'top'],
    out: 'qa-out',
    build: true,
    port: 4174,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--keep-as-is') {
      options.build = false;
    } else if (arg === '--out') {
      options.out = String(argv[++i] ?? options.out);
    } else if (arg === '--views') {
      options.views = String(argv[++i] ?? '').split(',').filter(Boolean);
    } else if (arg === '--port') {
      options.port = Number(argv[++i]);
      if (!Number.isInteger(options.port)) {
        throw new Error('--port needs a whole number');
      }
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

class McpClient {
  constructor(child) {
    this.child = child;
    this.pending = new Map();
    this.nextId = 1;
    createInterface({input: child.stdout}).on('line', (line) => {
      this.dispatch(line);
    });
  }

  dispatch(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const entry = this.pending.get(message.id);
    if (!entry) {
      return;
    }
    this.pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error(message.error.message ?? 'rpc error'));
      return;
    }
    entry.resolve(message.result);
  }

  send(message) {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  notify(method, params) {
    this.send({jsonrpc: '2.0', method, params});
  }

  request(method, params) {
    const id = this.nextId++;
    this.send({jsonrpc: '2.0', id, method, params});
    return new Promise((resolve_, reject_) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject_(new Error(`${method} timed out after ${CALL_TIMEOUT_MS} ms`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve_(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject_(error);
        },
      });
    });
  }

  async call(name, args = {}) {
    const result = await this.request('tools/call', {name, arguments: args});
    const content = result.content ?? [];
    if (result.isError) {
      const text = content.map((part) => part.text ?? '').join(' ');
      throw new Error(`${name} failed: ${text}`);
    }
    return content;
  }

  async callJson(name, args = {}) {
    const content = await this.call(name, args);
    const text = content.find((part) => part.type === 'text')?.text ?? '{}';
    return JSON.parse(text);
  }

  async tryJson(name, args = {}) {
    try {
      return await this.callJson(name, args);
    } catch {
      return null;
    }
  }

  async callText(name, args = {}) {
    const content = await this.call(name, args);
    return content.find((part) => part.type === 'text')?.text ?? '';
  }
}

function pendingScrews(parts) {
  return parts.reduce(
      (sum, part) => sum + (part.screwCount - part.screwsDone), 0);
}

async function captureViews(views, out, port) {
  const shots = [];
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({
      viewport: {width: 960, height: 540},
    });
    // The QA session runs inside an XR session, which draws to the XR
    // framebuffer and leaves the page canvas empty. A plain desktop page
    // renders the same scene, so the captures come from there.
    await page.goto(`http://localhost:${port}/`, {
      waitUntil: 'load',
    });
    await page.waitForFunction(() => window.factoryDebug !== undefined,
        undefined, {timeout: 60_000});
    // The credits splash shows on a timer shortly after boot and again on
    // completion, so a capture is only clean once it stays gone. The desktop
    // HUD is shell chrome no headset player sees; keep both out of the shots.
    const clearOverlays = async () => {
      for (let attempt = 0; attempt < 12; attempt++) {
        await page.evaluate(() => window.factoryDebug.splashSkip());
        await page.waitForTimeout(150);
        await page.evaluate(() => window.factoryDebug.hudVisible(false));
        const visible = await page.evaluate(
            () => window.factoryDebug.splashVisible());
        if (!visible) {
          return;
        }
      }
      throw new Error('credits splash never cleared for the capture');
    };
    await page.evaluate(() => window.factoryDebug.completeHand());
    // The credits splash is scheduled on a timer a couple of seconds after
    // boot and again once the hand is finished, so wait past both timers
    // before clearing, then confirm the panel stayed gone.
    await page.waitForTimeout(3200);
    await clearOverlays();
    await page.waitForTimeout(600);
    await clearOverlays();
    for (const view of views) {
      await page.evaluate((value) => {
        window.factoryDebug.debugView(value);
      }, view);
      await page.waitForTimeout(400);
      const buffer = await page.screenshot({type: 'png'});
      const file = resolve(out, `${view}.png`);
      await writeFile(file, buffer);
      shots.push({
        view,
        file,
        bytes: buffer.length,
        blank: buffer.length < BLANK_SHOT_BYTES,
      });
    }
  } finally {
    await browser.close();
  }
  return shots;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.out, {recursive: true});

  const child = spawn(
      process.execPath,
      [SERVER, '--port', String(options.port)],
      {stdio: ['pipe', 'pipe', 'inherit']},
  );
  const client = new McpClient(child);
  const shots = [];

  try {
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {name: 'critic', version: '1'},
    });
    client.notify('notifications/initialized', {});

    if (options.build) {
      await client.call('complete_build');
      await client.call('wait_ms', {ms: 600});
    }

    const audit = await client.callJson('audit_hand');
    const parts = await client.callJson('parts');
    // read_state throws once the build finishes ("assembly has no current
    // part"), so status detail is best-effort only.
    const state = (await client.tryJson('read_state')) ?? {};
    const pageErrors = await client.callText('page_errors');

    for (const shot of await captureViews(
        options.views, options.out, options.port)) {
      shots.push(shot);
    }

    const failed = audit.checks.filter((check) => !check.pass);
    const passed = audit.checks.length - failed.length;
    const errors = pageErrors === 'no page errors' ? [] : [pageErrors];
    const ok = Boolean(audit.ok) && errors.length === 0;

    const report = {
      generatedAt: new Date().toISOString(),
      ok,
      built: options.build,
      audit: {ok: Boolean(audit.ok), passed, total: audit.checks.length},
      failures: failed.map((check) => ({
        name: check.name,
        detail: check.detail,
      })),
      parts: {
        count: parts.length,
        placed: parts.filter((part) => part.placed).length,
        screwsPending: pendingScrews(parts),
      },
      status: {
        text: state.statusText,
        activePart: state.activePart,
        arrows: state.arrowCount,
        audience: state.audienceCount,
        lastError: state.lastError,
      },
      pageErrors: errors,
      shots,
    };

    await writeFile(
        resolve(options.out, 'critic.json'),
        `${JSON.stringify(report, null, 2)}\n`,
    );

    const verdict = ok ? 'PASS' : 'FAIL';
    console.log(`audit    ${verdict} ${passed}/${audit.checks.length}`);
    console.log(
        `parts    ${report.parts.placed}/${report.parts.count} placed, ` +
        `${report.parts.screwsPending} screws pending`,
    );
    console.log(`status   ${state.statusText ?? 'n/a after completion'}`);
    if (failed.length) {
      for (const check of failed) {
        console.log(`  fail   ${check.name}: ${JSON.stringify(check.detail)}`);
      }
    }
    if (errors.length) {
      console.log(`errors   ${errors.join(' | ')}`);
    }
    if (shots.length) {
      const totals = shots.map((shot) =>
        `${shot.view} ${Math.round(shot.bytes / 1024)}K`).join(', ');
      console.log(`shots    ${totals}`);
      const blank = shots.filter((shot) => shot.blank).map((shot) => shot.view);
      if (blank.length) {
        console.log(`  blank  ${blank.join(', ')}: capture came back empty`);
      }
    }
    process.exitCode = ok ? 0 : 1;
  } finally {
    child.stdin.end();
    child.kill();
  }
}

main().catch((error) => {
  console.error(`critic failed: ${error.message}`);
  process.exitCode = 1;
});
