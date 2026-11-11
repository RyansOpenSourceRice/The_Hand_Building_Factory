#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {get} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4174;
const BASE = `http://localhost:${PORT}`;
const MOCK_SCRIPT =
  resolve(ROOT, 'tests', 'xr-mock', 'xr-mock.js');
const PREVIEW_TIMEOUT_MS = 30_000;
const BOOT_TIMEOUT_MS = 30_000;

const PROFILE_LIST = {'factory-mock': {path: 'factory-mock'}};

function component(type, button, xAxis, yAxis) {
  const gamepadIndices = {button};
  if (xAxis !== undefined && yAxis !== undefined) {
    gamepadIndices.xAxis = xAxis;
    gamepadIndices.yAxis = yAxis;
  }
  return {type, gamepadIndices, visualResponses: {}};
}

function stickLayout() {
  return {
    components: {
      'xr-standard-trigger': component('trigger', 0),
      'xr-standard-squeeze': component('squeeze', 1),
      'xr-standard-thumbstick': component('thumbstick', 3, 2, 3),
    },
    gamepad: {mapping: 'xr-standard'},
    assetPath: 'controller.glb',
  };
}

const PROFILE = {
  profileId: 'factory-mock',
  layouts: {
    left: stickLayout(),
    right: stickLayout(),
    none: stickLayout(),
  },
};

const session = {
  preview: null,
  browser: null,
  page: null,
  starting: null,
  pageErrors: [],
};

async function waitMs(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

async function waitForPreview() {
  const deadline = Date.now() + PREVIEW_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await new Promise((done) => {
      const req = get(`${BASE}/`, (res) => {
        res.resume();
        done(res.statusCode === 200);
      });
      req.on('error', () => done(false));
      req.setTimeout(1000, () => {
        req.destroy();
        done(false);
      });
    });
    if (ok) {
      return;
    }
    await waitMs(300);
  }
  throw new Error(`preview server did not start on port ${PORT}`);
}

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
  child.on('exit', () => {
    if (session.preview === child) {
      session.preview = null;
    }
  });
  session.preview = child;
  await waitForPreview();
}

async function startSession() {
  if (session.page) {
    return session.page;
  }
  if (!session.starting) {
    session.starting = (async () => {
      if (!session.preview) {
        await startPreview();
      }
      const browser = await chromium.launch();
      const page = await browser.newPage({
        viewport: {width: 960, height: 540},
      });
      page.on('pageerror', (error) => {
        session.pageErrors.push(`pageerror: ${error.message}`);
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          session.pageErrors.push(`console.error: ${msg.text()}`);
        }
      });
      await page.addInitScript(() => {
        window.__XR_MOCK_CONFIG__ = {mockXr: true};
      });
      await page.addInitScript({
        content: readFileSync(MOCK_SCRIPT, 'utf8'),
      });
      await page.route('**/profiles/profilesList.json', (route) =>
        route.fulfill({json: PROFILE_LIST}));
      await page.route('**/profiles/factory-mock/profile.json', (route) =>
        route.fulfill({json: PROFILE}));
      await page.goto(`${BASE}/`);
      await page.waitForFunction(
          () => (document.getElementById('live-status')
              ?.getAttribute('data-ready')) === 'xr',
          undefined,
          {timeout: BOOT_TIMEOUT_MS},
      );
      await page.evaluate(() => window.factoryDebug.enterVr());
      await page.waitForFunction(
          () => window.__xrMock.state().controllersReady,
          undefined,
          {timeout: BOOT_TIMEOUT_MS},
      );
      session.browser = browser;
      session.page = page;
      return page;
    })();
    session.starting.catch(() => {
      session.starting = null;
    });
  }
  return session.starting;
}

async function stopSession() {
  session.starting = null;
  session.page = null;
  session.pageErrors = [];
  if (session.browser) {
    const browser = session.browser;
    session.browser = null;
    await browser.close().catch(() => {});
  }
  if (session.preview) {
    const child = session.preview;
    session.preview = null;
    child.kill();
  }
}

async function setController(side, patch) {
  const page = await startSession();
  await page.evaluate(({side, patch}) => {
    window.__xrMock.setController(side, patch);
  }, {side, patch});
}

async function readState() {
  const page = await startSession();
  return page.evaluate(() => {
    const debug = window.factoryDebug;
    const status = document.getElementById('live-status');
    return {
      statusText: status?.textContent ?? null,
      activePart: status?.getAttribute('data-part') ?? null,
      ready: status?.getAttribute('data-ready') ?? null,
      sceneReady: debug.state().ready,
      inXr: debug.state().inXr,
      rawMock: window.__xrMock.snapshot(),
      viewerYaw: debug.yaw(),
      camera: debug.camera(),
      pointerLeft: debug.pointer('left'),
      pointerRight: debug.pointer('right'),
      pointerRotLeft: debug.pointerRot('left'),
      pointerRotRight: debug.pointerRot('right'),
      activePartCenter: debug.partCenter(),
      screwSites: debug.sites(),
      driverTip: debug.tip(),
      driverCenter: debug.driverCenter(),
    };
  });
}

function numberArg(args, name) {
  const value = Number(args?.[name]);
  if (!Number.isFinite(value)) {
    throw new Error(`expected a finite number for "${name}"`);
  }
  return value;
}

function sideArg(args) {
  const side = args?.side ?? 'right';
  if (side !== 'left' && side !== 'right') {
    throw new Error('"side" must be "left" or "right"');
  }
  return side;
}

const TOOLS = [
  {
    name: 'read_state',
    description: 'Snapshot of the game state: status text, announced ' +
      'part, viewer yaw, controller world poses, active part center, ' +
      'screw sites, screwdriver tip and center. World space: +x right, ' +
      '+y up, +z toward the player.',
    inputSchema: {type: 'object', properties: {}},
  },
  {
    name: 'screenshot',
    description: 'PNG screenshot of the game window as rendered ' +
      '(WebXR view emulated by the mock).',
    inputSchema: {type: 'object', properties: {}},
  },
  {
    name: 'page_errors',
    description: 'Console errors and uncaught page errors seen so far, ' +
      'oldest first. Check this after any odd behavior.',
    inputSchema: {type: 'object', properties: {}},
  },
  {
    name: 'wait_ms',
    description: 'Wait for game animations to settle (tweens, part ' +
      'spawns). Cap 5000 ms.',
    inputSchema: {
      type: 'object',
      properties: {ms: {type: 'number', maximum: 5000}},
      required: ['ms'],
    },
  },
  {
    name: 'pose',
    description: 'Place a controller in world space. The pointer ray ' +
      'points along yaw/pitch (0 pitch = level, +pi/2 = straight down). ' +
      'World axes: +x right, +y up, +z toward the player.',
    inputSchema: {
      type: 'object',
      properties: {
        side: {enum: ['left', 'right']},
        x: {type: 'number'},
        y: {type: 'number'},
        z: {type: 'number'},
        yaw: {type: 'number'},
        pitch: {type: 'number'},
      },
      required: ['side', 'x', 'y', 'z'],
    },
  },
  {
    name: 'stick',
    description: 'Move a thumbstick (xr-standard axes: +x right, ' +
      '+y forward). The game drives screws when the tool is held and ' +
      'the stick is pushed.',
    inputSchema: {
      type: 'object',
      properties: {
        side: {enum: ['left', 'right']},
        x: {type: 'number'},
        y: {type: 'number'},
        pressed: {type: 'boolean'},
      },
      required: ['side', 'x', 'y'],
    },
  },
  {
    name: 'trigger',
    description: 'Set a trigger value (1 = press, 0 = release). ' +
      'Pressing grabs whatever the pointer ray hits; releasing drops.',
    inputSchema: {
      type: 'object',
      properties: {
        side: {enum: ['left', 'right']},
        value: {type: 'number'},
      },
      required: ['side', 'value'],
    },
  },
  {
    name: 'squeeze',
    description: 'Set a grip value (1 = squeeze, 0 = release). ' +
      'Squeezing while holding the tool drops it and re-announces ' +
      'the current part.',
    inputSchema: {
      type: 'object',
      properties: {
        side: {enum: ['left', 'right']},
        value: {type: 'number'},
      },
      required: ['side', 'value'],
    },
  },
];

async function callTool(name, args) {
  switch (name) {
    case 'read_state':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(await readState(), null, 2),
        }],
      };
    case 'screenshot': {
      const page = await startSession();
      const image = await page.screenshot({type: 'png'});
      return {
        content: [{
          type: 'image',
          data: image.toString('base64'),
          mimeType: 'image/png',
        }],
      };
    }
    case 'page_errors':
      return {
        content: [{
          type: 'text',
          text: session.pageErrors.length ?
            session.pageErrors.join('\n') : 'no page errors',
        }],
      };
    case 'wait_ms':
      await waitMs(Math.min(5000, numberArg(args, 'ms')));
      return {content: [{type: 'text', text: 'waited'}]};
    case 'pose': {
      const side = sideArg(args);
      await setController(side, {
        x: numberArg(args, 'x'),
        y: numberArg(args, 'y'),
        z: -numberArg(args, 'z'),
        yaw: -(args?.yaw ?? 0),
        pitch: -(args?.pitch ?? 0),
      });
      return {content: [{type: 'text', text: `${side} posed`}]};
    }
    case 'stick': {
      const side = sideArg(args);
      await setController(side, {
        stickX: numberArg(args, 'x'),
        stickY: numberArg(args, 'y'),
        ...(args?.pressed === undefined ? {} :
          {stickPressed: Boolean(args.pressed)}),
      });
      return {content: [{type: 'text', text: `${side} stick set`}]};
    }
    case 'trigger': {
      const side = sideArg(args);
      await setController(side, {trigger: numberArg(args, 'value')});
      return {content: [{type: 'text', text: `${side} trigger set`}]};
    }
    case 'squeeze': {
      const side = sideArg(args);
      await setController(side, {squeeze: numberArg(args, 'value')});
      return {content: [{type: 'text', text: `${side} squeeze set`}]};
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(id, result) {
  send({jsonrpc: '2.0', id, result});
}

function fail(id, code, message) {
  send({jsonrpc: '2.0', id, error: {code, message}});
}

const SERVER_INFO = {
  name: 'hands-on-qa',
  title: 'HANDS ON! embodied QA server',
  version: '1.0.0',
};

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  for (;;) {
    const nl = buffer.indexOf('\n');
    if (nl === -1) {
      break;
    }
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (line.trim()) {
      handleMessage(line);
    }
  }
});

function handleMessage(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    fail(null, -32700, 'parse error');
    return;
  }
  const {id, method, params} = message;
  try {
    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: params?.protocolVersion ?? '2024-11-05',
          capabilities: {tools: {}},
          serverInfo: SERVER_INFO,
        });
        break;
      case 'notifications/initialized':
      case 'notifications/cancelled':
        break;
      case 'ping':
        respond(id, {});
        break;
      case 'tools/list':
        respond(id, {tools: TOOLS});
        break;
      case 'tools/call': {
        const {name} = params ?? {};
        callTool(name, params?.arguments ?? {}).then(
            (result) => respond(id, result),
            (error) => respond(id, {
              content: [{type: 'text', text: String(error?.message ??
                error)}],
              isError: true,
            }),
        );
        break;
      }
      default:
        if (id !== undefined && id !== null) {
          fail(id, -32601, `method not found: ${method}`);
        }
    }
  } catch (error) {
    if (id !== undefined && id !== null) {
      fail(id, -32603, String(error?.message ?? error));
    }
  }
}

process.on('SIGINT', () => {
  stopSession().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  stopSession().then(() => process.exit(0));
});
process.on('exit', () => {
  if (session.preview) {
    session.preview.kill();
  }
  if (session.browser) {
    session.browser.close();
  }
});
