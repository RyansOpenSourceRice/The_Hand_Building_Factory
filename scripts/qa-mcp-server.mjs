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

function stickLayout(hand) {
  const components = {
    'xr-standard-trigger': component('trigger', 0),
    'xr-standard-squeeze': component('squeeze', 1),
    'xr-standard-thumbstick': component('thumbstick', 3, 2, 3),
  };
  if (hand === 'left') {
    components['x-button'] = component('button', 4);
    components['y-button'] = component('button', 5);
  } else {
    components['a-button'] = component('button', 4);
    components['b-button'] = component('button', 5);
  }
  return {
    components,
    gamepad: {mapping: 'xr-standard'},
    selectComponentId: 'xr-standard-trigger',
    assetPath: 'controller.glb',
  };
}

const PROFILE = {
  profileId: 'factory-mock',
  layouts: {
    left: stickLayout('left'),
    right: stickLayout('right'),
    none: stickLayout('right'),
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
      toolEquipped: debug.toolEquipped(),
      toolVisible: debug.toolVisible(),
      toolParent: debug.toolParent(),
      arrowCount: debug.arrowCount(),
      guidance: debug.guidance(),
      voice: debug.voice(),
      hostGlow: debug.hostGlow(),
      parts: debug.parts(),
      audioChannels: debug.audioChannels(),
      audienceCount: debug.audienceCount(),
      perf: debug.perf(),
      audio: debug.audio(),
      lastError: debug.lastError(),
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

function boundsOf(part) {
  return {min: part.min, max: part.max};
}

function overlaps(a, b) {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
}

function auditHand(parts) {
  const byId = new Map(parts.map((part) => [part.id, part]));
  const palm = byId.get('palm');
  const index = byId.get('finger-index');
  const little = byId.get('finger-little');
  const middle = byId.get('finger-middle');
  const ring = byId.get('finger-ring');
  const thumbBase = byId.get('thumb-base');
  const thumbSegments = byId.get('thumb-segments');
  const cover = byId.get('upper-cover');
  const checks = [];
  const add = (name, pass, detail) => checks.push({name, pass, detail});
  add('part count', parts.length === 13, `${parts.length}/13`);
  add('all placed', parts.every((part) => part.placed),
      parts.filter((part) => !part.placed).map((part) => part.id));
  add('all screwed', parts.every((part) => part.screwsDone === part.screwCount),
      parts.filter((part) => part.screwsDone !== part.screwCount)
          .map((part) => part.id));
  add('all visible', parts.every((part) => part.enabled),
      parts.filter((part) => !part.enabled).map((part) => part.id));
  if (!palm || !index || !little || !middle || !ring || !thumbBase ||
      !thumbSegments || !cover) {
    add('required parts', false, 'palm, fingers, thumb, cover missing');
    return {ok: false, checks};
  }
  const palmBox = boundsOf(palm);
  add('palm on pedestal', Math.abs(palm.min[1] - 1.07) <= 0.02,
      `palm bottom ${palm.min[1].toFixed(3)} m`);
  add('palm upright', palm.max[1] < 1.4 && palm.max[1] > 1.3,
      `palm top ${palm.max[1].toFixed(3)} m`);
  add('fingertips above palm', index.max[1] > 1.65,
      `index tip ${index.max[1].toFixed(3)} m`);
  add('fingers joined to palm',
      overlaps(boundsOf(index), palmBox) && index.min[1] < palm.max[1] + 0.03,
      `finger base ${index.min[1].toFixed(3)} m`);
  add('finger order',
      index.center[0] > middle.center[0] &&
      middle.center[0] > ring.center[0] &&
      ring.center[0] > little.center[0],
      [index, middle, ring, little]
          .map((part) => part.center[0].toFixed(3)).join(' > '));
  add('fingers span the palm',
      index.max[0] - little.min[0] > 0.2 &&
      index.max[0] - little.min[0] < 0.35,
      `${(index.max[0] - little.min[0]).toFixed(3)} m`);
  add('thumb joined to palm', overlaps(boundsOf(thumbBase), palmBox),
      `thumb base y ${thumbBase.min[1].toFixed(3)}`);
  add('thumb segments joined',
      overlaps(boundsOf(thumbSegments), boundsOf(thumbBase)),
      `segments y ${thumbSegments.min[1].toFixed(3)}`);
  add('cover joined to palm', overlaps(boundsOf(cover), palmBox),
      `cover y ${cover.min[1].toFixed(3)}`);
  add('no scattered parts',
      parts.every((part) => Math.abs(part.min[2]) < 0.16 &&
          Math.abs(part.max[2]) < 0.16),
      parts.filter((part) => Math.abs(part.min[2]) >= 0.16 ||
          Math.abs(part.max[2]) >= 0.16).map((part) => part.id));
  add('inside reach',
      parts.every((part) => part.min[1] > 0.95 && part.max[1] < 1.8),
      parts.filter((part) => part.min[1] <= 0.95 ||
          part.max[1] >= 1.8).map((part) => part.id));
  return {ok: checks.every((check) => check.pass), checks};
}

const TOOLS = [
  {
    name: 'read_state',
    description: 'Snapshot of the game state: status text, announced ' +
      'part, viewer yaw, controller world poses, active part center, ' +
      'screw sites, screwdriver tip and center, whether the screwdriver ' +
      'is equipped or visible and what it is parented to, guide arrow ' +
      'count, guidance, voice, host glow, audience count, audio state, ' +
      'render stats, and the last runtime error. World space: +x right, ' +
      '+y up, +z toward the player.',
    inputSchema: {type: 'object', properties: {}},
  },
  {
    name: 'audit_hand',
    description: 'Compare the current assembly to the formal hand model: ' +
      'part count, placement, screws, palm height, fingertip height, finger ' +
      'order and span, thumb/cover attachment, reach envelope, and scattered ' +
      'parts. Returns pass/fail checks. Run after complete_build or a ' +
      'playthrough.',
    inputSchema: {type: 'object', properties: {}},
  },
  {
    name: 'parts',
    description: 'Full world-space state for every hand part: bounds, ' +
      'centre, target, quaternion, placed flag, and screw progress.',
    inputSchema: {type: 'object', properties: {}},
  },
  {
    name: 'complete_build',
    description: 'Debug shortcut: place every remaining part and drive every ' +
      'screw so the final hand can be inspected. Does not replace a ' +
      'start-to-finish playthrough.',
    inputSchema: {type: 'object', properties: {}},
  },
  {
    name: 'view',
    description: 'Move the desktop QA camera to a fixed view of the hand.',
    inputSchema: {
      type: 'object',
      properties: {
        view: {enum: ['front', 'back', 'left', 'right', 'top', 'servos']},
      },
      required: ['view'],
    },
  },
  {
    name: 'part_visibility',
    description: 'Show or hide one hand part for close inspection. ' +
      'For example hide upper-cover to inspect the servos.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {type: 'string'},
        visible: {type: 'boolean'},
      },
      required: ['id', 'visible'],
    },
  },
  {
    name: 'audio_channels',
    description: 'Current narration keys, music playing state, and active ' +
      'effect keys. Poll this during a build to detect overlapping audio.',
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
      'Grip drops a held part or stows the screwdriver; empty-hand ' +
      'squeezes do nothing.',
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
    name: 'b_button',
    description: 'Press the tool button (B on the right controller, ' +
      'Y on the left): 1 = press, 0 = release. Summons or stows the ' +
      'screwdriver.',
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
    name: 'a_button',
    description: 'Press the menu button (A on the right controller, ' +
      'X on the left): 1 = press, 0 = release. Toggles the in-headset ' +
      'menu panel.',
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
    case 'audit_hand': {
      const page = await startSession();
      const parts = await page.evaluate(() => window.factoryDebug.parts());
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(auditHand(parts), null, 2),
        }],
      };
    }
    case 'parts': {
      const page = await startSession();
      const parts = await page.evaluate(() => window.factoryDebug.parts());
      return {content: [{type: 'text', text: JSON.stringify(parts, null, 2)}]};
    }
    case 'complete_build': {
      const page = await startSession();
      await page.evaluate(() => window.factoryDebug.completeHand());
      await waitMs(300);
      return {content: [{type: 'text', text: 'completed hand'}]};
    }
    case 'view': {
      const page = await startSession();
      const view = args?.view;
      if (!['front', 'back', 'left', 'right', 'top', 'servos']
          .includes(view)) {
        throw new Error('unknown view');
      }
      await page.evaluate((value) => window.factoryDebug.debugView(value),
          view);
      await waitMs(150);
      return {content: [{type: 'text', text: `${view} view`}]};
    }
    case 'part_visibility': {
      const page = await startSession();
      const id = String(args?.id ?? '');
      if (!id) {
        throw new Error('missing part id');
      }
      await page.evaluate(({partId, visible}) => {
        window.factoryDebug.hidePart(partId, visible);
      }, {partId: id, visible: Boolean(args?.visible)});
      return {content: [{type: 'text', text: `${id} visibility set`}]};
    }
    case 'audio_channels': {
      const page = await startSession();
      const channels = await page.evaluate(
          () => window.factoryDebug.audioChannels());
      return {
        content: [{type: 'text', text: JSON.stringify(channels, null, 2)}],
      };
    }
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
    case 'b_button': {
      const side = sideArg(args);
      await setController(side, {bButton: numberArg(args, 'value')});
      return {content: [{type: 'text', text: `${side} b-button set`}]};
    }
    case 'a_button': {
      const side = sideArg(args);
      await setController(side, {aButton: numberArg(args, 'value')});
      return {content: [{type: 'text', text: `${side} a-button set`}]};
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
