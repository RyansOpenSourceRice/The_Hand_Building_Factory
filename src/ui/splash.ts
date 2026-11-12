import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Rectangle,
  TextBlock,
} from '@babylonjs/gui';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Axis, Space} from '@babylonjs/core/Maths/math.axis';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Camera} from '@babylonjs/core/Cameras/camera';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import type {Scene} from '@babylonjs/core/scene';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import {WebXRState} from '@babylonjs/core/XR/webXRTypes';
import {pulseControllerSoft} from '../input/xrGrab';
import {SPLASH_GATE_MS, SplashGate} from './splashGate';

const FONT = '\'Atkinson Hyperlegible\', system-ui, sans-serif';
const SPLASH_WIDTH = 840;
const SPLASH_HEIGHT = 640;
const SPLASH_DISTANCE = 0.9;
const SPLASH_LIFT = 0.15;

const CREDIT_LINES = [
  'Hand model based on the Yeah Hand by OPSOBOT',
  'github.com/opsobot/yeah-hand',
  'CERN Open Hardware Licence 2 - Strongly Reciprocal',
  'Modified and used in this game by RyansOpenSourceRice.',
  'Not affiliated with or endorsed by OPSOBOT.',
];
const FONT_LINE = 'Font: Atkinson Hyperlegible (SIL OFL 1.1)';
const BUTTON_BACKGROUND = 'rgba(35, 45, 80, 0.9)';
const BUTTON_HOVER = 'rgba(78, 94, 150, 0.95)';

export type SplashActions = {
  rebuild: () => void;
};

export class CreditSplash {
  private readonly scene: Scene;
  private readonly plane: Mesh;
  private readonly adt: AdvancedDynamicTexture;
  private readonly actions: SplashActions | null;
  private readonly continueButton: Button;
  private readonly rebuildButton: Button;
  private readonly gateLabel: TextBlock;
  private readonly heading: TextBlock;
  private cam: Camera | null = null;
  private xr: WebXRDefaultExperience | null = null;
  private readonly gate = new SplashGate();
  private visible = false;
  onDismissed: (() => void) | null = null;
  onShown: (() => void) | null = null;

  constructor(scene: Scene, actions: SplashActions | null = null) {
    this.scene = scene;
    this.actions = actions;
    this.plane = MeshBuilder.CreatePlane('creditSplash', {size: 0.5}, scene);
    this.plane.setEnabled(false);
    this.adt = AdvancedDynamicTexture.CreateForMesh(
        this.plane,
        SPLASH_WIDTH,
        SPLASH_HEIGHT,
    );

    const backing = new Rectangle('splash-backing');
    backing.width = `${SPLASH_WIDTH - 60}px`;
    backing.height = `${SPLASH_HEIGHT - 40}px`;
    backing.background = 'rgba(16, 21, 38, 0.95)';
    backing.color = 'rgba(140, 160, 220, 1)';
    backing.thickness = 2;
    backing.cornerRadius = 16;
    this.adt.addControl(backing);

    const heading = new TextBlock('splash-heading', 'CREDITS');
    heading.fontFamily = FONT;
    heading.fontSize = '44px';
    heading.color = '#f2f4ff';
    heading.top = '-250px';
    this.adt.addControl(heading);
    this.heading = heading;

    const lineTop = -170;
    CREDIT_LINES.forEach((line, index) => {
      const text = new TextBlock(`splash-line-${index}`, line);
      text.fontFamily = FONT;
      text.fontSize = '26px';
      text.color = '#c9d4ff';
      text.top = `${lineTop + index * 52}px`;
      this.adt.addControl(text);
    });

    const fontNote = new TextBlock('splash-font', FONT_LINE);
    fontNote.fontFamily = FONT;
    fontNote.fontSize = '20px';
    fontNote.color = '#8fa0d8';
    fontNote.top = '120px';
    this.adt.addControl(fontNote);

    const gate = new TextBlock('splash-gate', 'You can continue in 4 s');
    gate.fontFamily = FONT;
    gate.fontSize = '22px';
    gate.color = '#8fa0d8';
    gate.top = '215px';
    this.adt.addControl(gate);
    this.gateLabel = gate;

    const buildTag = new TextBlock('splash-build', `v${__APP_VERSION__}`);
    buildTag.fontFamily = FONT;
    buildTag.fontSize = '16px';
    buildTag.color = '#8fa0d8';
    buildTag.resizeToFit = true;
    buildTag.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    buildTag.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    buildTag.top = '-34px';
    this.adt.addControl(buildTag);

    this.continueButton = this.makeAction(
        'splash-continue', 'CONTINUE', -130, '250px');
    this.continueButton.onPointerClickObservable.add(() => this.dismiss());

    this.rebuildButton = this.makeAction(
        'splash-rebuild', 'REBUILD', 130, '250px');
    this.rebuildButton.onPointerClickObservable.add(() => {
      this.actions?.rebuild();
      this.dismiss();
    });
    this.rebuildButton.isVisible = false;

    scene.onBeforeRenderObservable.add(() => this.tickGate());
  }

  private makeAction(
      name: string,
      label: string,
      left: number,
      top: string,
  ): Button {
    const button = Button.CreateSimpleButton(name, label);
    button.fontFamily = FONT;
    button.fontSize = '28px';
    button.color = '#f2f4ff';
    button.background = BUTTON_BACKGROUND;
    button.cornerRadius = 8;
    button.width = '220px';
    button.height = '70px';
    button.left = `${left}px`;
    button.top = top;
    button.isEnabled = false;
    button.alpha = 0.45;
    button.onPointerEnterObservable.add(() => {
      if (button.isEnabled) {
        button.background = BUTTON_HOVER;
      }
    });
    button.onPointerOutObservable.add(() => {
      button.background = BUTTON_BACKGROUND;
    });
    this.adt.addControl(button);
    return button;
  }

  setCamera(cam: Camera): void {
    this.cam = cam;
  }

  attach(xr: WebXRDefaultExperience): void {
    this.xr = xr;
    xr.input.onControllerAddedObservable.add((ctrl) => {
      ctrl.onMotionControllerInitObservable.add((mc) => {
        for (const id of ['a-button', 'x-button']) {
          const component = mc.components[id];
          component?.onButtonStateChangedObservable.add(() => {
            if (component.pressed && this.visible) {
              this.skip();
            }
          });
        }
      });
    });
  }

  private placementCamera(): Camera | null {
    if (this.xr &&
        this.xr.baseExperience.state === WebXRState.IN_XR) {
      return this.xr.baseExperience.camera;
    }
    return this.cam ?? this.scene.activeCamera;
  }

  show(withRebuild = false): void {
    if (this.visible) {
      return;
    }
    this.heading.text = withRebuild ?
      'YOU BUILT THE HAND!' : 'CREDITS';
    this.rebuildButton.isVisible = withRebuild;
    this.placeInFront();
    this.gate.reset(performance.now());
    this.setGate(this.continueButton, false);
    this.setGate(this.rebuildButton, false);
    this.gateLabel.text = 'You can continue in 4 s';
    this.plane.setEnabled(true);
    this.visible = true;
    pulseControllerSoft('xr');
    this.onShown?.();
  }

  skip(): void {
    if (!this.visible || !this.gate.elapsed()) {
      return;
    }
    this.dismiss();
  }

  isVisible(): boolean {
    return this.visible;
  }

  gateElapsed(): boolean {
    return this.gate.elapsed();
  }

  buttonBackground(): string {
    return this.continueButton.background;
  }

  debugPosition(): number[] {
    const p = this.plane.position;
    return [p.x, p.y, p.z];
  }

  debugCam(): number[] {
    const cam = this.cam;
    if (!cam) {
      return [];
    }
    const d = cam.getDirection(Vector3.Forward());
    return [cam.position.x, cam.position.y, cam.position.z, d.x, d.y, d.z];
  }

  debugSkip(): void {
    this.gate.reset(performance.now() - SPLASH_GATE_MS - 1);
    this.tickGate();
    this.skip();
  }

  debugRegate(): void {
    this.gate.reset(performance.now());
    this.setGate(this.continueButton, false);
    this.setGate(this.rebuildButton, false);
  }

  debugRebuild(): void {
    if (!this.visible || !this.gate.elapsed()) {
      return;
    }
    this.actions?.rebuild();
    this.dismiss();
  }

  private dismiss(): void {
    if (!this.visible || !this.gate.elapsed()) {
      return;
    }
    this.plane.setEnabled(false);
    this.visible = false;
    pulseControllerSoft('xr');
    this.onDismissed?.();
  }

  private tickGate(): void {
    if (!this.visible) {
      return;
    }
    const now = performance.now();
    if (this.gate.tick(now)) {
      this.setGate(this.continueButton, true);
      this.setGate(this.rebuildButton, true);
      this.gateLabel.text = '';
      return;
    }
    const remaining = this.gate.remainingSeconds(now);
    this.gateLabel.text =
      remaining === null ? '' : `You can continue in ${remaining} s`;
  }

  private setGate(button: Button, enabled: boolean): void {
    button.isEnabled = enabled;
    button.alpha = enabled ? 1 : 0.45;
  }

  private placeInFront(): void {
    const cam = this.placementCamera();
    if (!cam) {
      return;
    }
    const forward = cam.getDirection(Vector3.Forward());
    const position = cam.position.add(forward.scale(SPLASH_DISTANCE));
    position.y += SPLASH_LIFT;
    this.plane.position.copyFrom(position);
    this.plane.lookAt(cam.position);
    this.plane.rotate(Axis.Y, Math.PI, Space.LOCAL);
  }
}
