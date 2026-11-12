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
import {FILAMENT_COLORS, type ThemeSlot} from '../game/palette';
import type {SnapAngle, TurnMode} from '../game/settings';
import {pulseControllerSoft} from '../input/xrGrab';

const FONT = '\'Atkinson Hyperlegible\', system-ui, sans-serif';
const MENU_WIDTH = 840;
const MENU_HEIGHT = 720;
const ALL_STEPS = 9999;
const MENU_DISTANCE = 0.75;
const MENU_DROP = 0.12;

export type VrMenuActions = {
  reset: () => void;
  undo: (count: number) => void;
  redo: (count: number) => void;
  undoDepth: () => number;
  redoDepth: () => number;
  cycleTurnMode: () => void;
  cycleSnapAngle: () => void;
  setTheme: (slot: ThemeSlot, colorIndex: number) => void;
};

const ROW_LABELS: Readonly<Array<[ThemeSlot, string]>> = [
  ['primary', 'PRIMARY'],
  ['secondary', 'SECONDARY'],
  ['tertiary', 'TERTIARY'],
];

const BUTTON_BACKGROUND = 'rgba(35, 45, 80, 0.9)';
const BUTTON_HOVER = 'rgba(78, 94, 150, 0.95)';

function makeButton(
    name: string,
    label: string,
    width: number,
    height: number,
    top: number,
    left: number,
    fontSize = 24,
): Button {
  const button = Button.CreateSimpleButton(name, label);
  button.fontFamily = FONT;
  button.fontSize = `${fontSize}px`;
  button.color = '#f2f4ff';
  button.background = BUTTON_BACKGROUND;
  button.cornerRadius = 8;
  button.width = `${width}px`;
  button.height = `${height}px`;
  button.top = `${top}px`;
  button.left = `${left}px`;
  button.onPointerEnterObservable.add(() => {
    button.background = BUTTON_HOVER;
  });
  button.onPointerOutObservable.add(() => {
    button.background = BUTTON_BACKGROUND;
  });
  return button;
}

export class VrMenu {
  private readonly plane: Mesh;
  private readonly adt: AdvancedDynamicTexture;
  private readonly actions: VrMenuActions;
  private readonly pages: Record<string, Control[]> = {};
  private readonly swatches: Array<{
    button: Button;
    slot: ThemeSlot;
    index: number;
  }> = [];
  private undoCountText: TextBlock | null = null;
  private redoCountText: TextBlock | null = null;
  private turnButton: Button | null = null;
  private angleButton: Button | null = null;
  private theme = {primary: 3, secondary: 2, tertiary: 0};
  private undoCount = 1;
  private redoCount = 1;
  private visible = false;
  private suppressed = false;
  private cam: Camera | null = null;
  onToggled: ((open: boolean) => void) | null = null;

  private scene: Scene;

  constructor(scene: Scene, actions: VrMenuActions) {
    this.scene = scene;
    this.actions = actions;
    this.plane = MeshBuilder.CreatePlane('vrMenu', {size: 0.42}, scene);
    this.plane.setEnabled(false);
    this.adt = AdvancedDynamicTexture.CreateForMesh(
        this.plane,
        MENU_WIDTH,
        MENU_HEIGHT,
    );

    const backing = new Rectangle('menu-backing');
    backing.width = `${MENU_WIDTH - 60}px`;
    backing.height = `${MENU_HEIGHT - 40}px`;
    backing.background = 'rgba(16, 21, 38, 0.92)';
    backing.color = 'rgba(140, 160, 220, 1)';
    backing.thickness = 2;
    backing.cornerRadius = 16;
    this.adt.addControl(backing);

    this.buildTabBar();
    const controls = new TextBlock(
        'menu-controls',
        'TRIGGER grab  ·  GRIP put away  ·  B / Y screwdriver  ·  A / X menu',
    );
    controls.fontFamily = FONT;
    controls.fontSize = '19px';
    controls.color = '#8f9cc4';
    controls.resizeToFit = true;
    controls.top = '300px';
    this.adt.addControl(controls);
    this.buildMainPage();
    this.buildMovePage();
    this.buildLooksPage();
    this.showPage('main');
    this.refreshCounts();
  }

  private add(page: string, control: Control): void {
    (this.pages[page] ??= []).push(control);
    control.isVisible = false;
    this.adt.addControl(control);
  }

  private buildTabBar(): void {
    const specs: Array<[string, number]> = [
      ['main', -300],
      ['move', -140],
      ['looks', 20],
    ];
    for (const [name, left] of specs) {
      const tab = makeButton(
          `tab-${name}`, name.toUpperCase(), 150, 64, -320, left, 22);
      tab.onPointerClickObservable.add(() => this.showPage(name));
      this.adt.addControl(tab);
    }
    const close = makeButton('menu-close', 'CLOSE', 150, 64, -320, 280, 22);
    close.onPointerClickObservable.add(() => this.hide());
    this.adt.addControl(close);
  }

  private buildStepRow(
      label: string,
      top: number,
      which: 'undo' | 'redo',
  ): void {
    const name = new TextBlock(`${which}-label`, label);
    name.fontFamily = FONT;
    name.fontSize = '30px';
    name.color = '#f2f4ff';
    name.resizeToFit = true;
    name.left = -340;
    name.top = `${top}px`;
    this.add('main', name);

    const minus = makeButton(`${which}-minus`, '-', 70, 60, top, -140, 30);
    minus.onPointerClickObservable.add(() => this.stepCount(which, -1));
    this.add('main', minus);

    const badge = new Rectangle(`${which}-count-badge`);
    badge.width = '96px';
    badge.height = '56px';
    badge.background = 'rgba(35, 45, 80, 0.9)';
    badge.color = 'rgba(140, 160, 220, 1)';
    badge.thickness = 1;
    badge.cornerRadius = 8;
    badge.left = -50;
    badge.top = `${top}px`;
    this.add('main', badge);

    const count = new TextBlock(`${which}-count`, '× 1');
    count.fontFamily = FONT;
    count.fontSize = '28px';
    count.color = '#c9d4ff';
    badge.addControl(count);
    if (which === 'undo') {
      this.undoCountText = count;
    } else {
      this.redoCountText = count;
    }

    const plus = makeButton(`${which}-plus`, '+', 70, 60, top, 30, 30);
    plus.onPointerClickObservable.add(() => this.stepCount(which, 1));
    this.add('main', plus);

    const go = makeButton(`${which}-go`, label, 150, 60, top, 160, 26);
    go.onPointerClickObservable.add(() => {
      if (which === 'undo') {
        this.actions.undo(this.undoCount);
      } else {
        this.actions.redo(this.redoCount);
      }
      this.refreshCounts();
    });
    this.add('main', go);

    const all = makeButton(`${which}-all`, 'ALL', 110, 60, top, 330, 26);
    all.onPointerClickObservable.add(() => {
      if (which === 'undo') {
        this.actions.undo(ALL_STEPS);
      } else {
        this.actions.redo(ALL_STEPS);
      }
      this.refreshCounts();
    });
    this.add('main', all);
  }

  private buildMainPage(): void {
    const reset = makeButton('menu-reset', 'RESET', 320, 70, -220, 0, 30);
    reset.onPointerClickObservable.add(() => {
      this.actions.reset();
      this.refreshCounts();
    });
    this.add('main', reset);
    this.buildStepRow('UNDO', -90, 'undo');
    this.buildStepRow('REDO', 30, 'redo');
  }

  private buildMovePage(): void {
    const turn = makeButton('menu-turn', 'TURN: SNAP', 340, 70, -140, 0, 28);
    turn.onPointerClickObservable.add(() => this.actions.cycleTurnMode());
    this.add('move', turn);
    this.turnButton = turn;

    const angle = makeButton('menu-angle', 'ANGLE: 45°', 340, 70, -30, 0, 28);
    angle.onPointerClickObservable.add(() => this.actions.cycleSnapAngle());
    this.add('move', angle);
    this.angleButton = angle;
  }

  private buildLooksPage(): void {
    ROW_LABELS.forEach(([slot, label], row) => {
      const top = -160 + row * 140;
      const text = new TextBlock(`menu-themeLabel-${slot}`, label);
      text.fontFamily = FONT;
      text.fontSize = '24px';
      text.color = '#f2f4ff';
      text.resizeToFit = true;
      text.left = -320;
      text.top = `${top}px`;
      this.add('looks', text);

      FILAMENT_COLORS.forEach((color, index) => {
        const swatch = Button.CreateSimpleButton(
            `menu-swatch-${slot}-${index}`, '');
        swatch.background = color.hex;
        swatch.cornerRadius = 6;
        swatch.width = '56px';
        swatch.height = '56px';
        swatch.thickness = 1;
        swatch.color = '#ffffff';
        swatch.left = `${-120 + index * 92}px`;
        swatch.top = `${top}px`;
        swatch.onPointerClickObservable.add(() => {
          this.actions.setTheme(slot, index);
        });
        swatch.onPointerEnterObservable.add(() => {
          swatch.thickness = 3;
        });
        swatch.onPointerOutObservable.add(() => {
          swatch.thickness = this.theme[slot] === index ? 3 : 1;
        });
        this.add('looks', swatch);
        this.swatches.push({button: swatch, slot, index});
      });
    });
  }

  private showPage(name: string): void {
    for (const [key, controls] of Object.entries(this.pages)) {
      for (const control of controls) {
        control.isVisible = key === name;
      }
    }
  }

  private stepCount(which: 'undo' | 'redo', delta: number): void {
    if (which === 'undo') {
      this.undoCount = Math.max(1, this.undoCount + delta);
    } else {
      this.redoCount = Math.max(1, this.redoCount + delta);
    }
    this.refreshCounts();
  }

  private refreshCounts(): void {
    const undoDepth = Math.max(1, this.actions.undoDepth());
    const redoDepth = Math.max(1, this.actions.redoDepth());
    this.undoCount = Math.min(this.undoCount, undoDepth);
    this.redoCount = Math.min(this.redoCount, redoDepth);
    if (this.undoCountText) {
      this.undoCountText.text = `× ${this.undoCount}`;
    }
    if (this.redoCountText) {
      this.redoCountText.text = `× ${this.redoCount}`;
    }
  }

  attach(xr: WebXRDefaultExperience): void {
    this.cam = xr.baseExperience.camera;
    xr.input.onControllerAddedObservable.add((ctrl) => {
      ctrl.onMotionControllerInitObservable.add((mc) => {
        for (const id of ['a-button', 'x-button']) {
          const component = mc.components[id];
          component?.onButtonStateChangedObservable.add(() => {
            if (component.pressed && !this.suppressed) {
              this.toggle();
            }
          });
        }
      });
    });
  }

  setSuppressed(value: boolean): void {
    this.suppressed = value;
  }

  buttonBackgrounds(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of ['menu-reset', 'menu-turn', 'menu-angle',
      'menu-close']) {
      const control = this.adt.getControlByName(name);
      if (control instanceof Button) {
        out[name] = control.background;
      }
    }
    return out;
  }

  private toggle(): void {
    if (this.visible) {
      this.hide();
      return;
    }
    this.placeInFront();
    this.refreshCounts();
    this.plane.setEnabled(true);
    this.visible = true;
    pulseControllerSoft('xr');
    this.onToggled?.(true);
  }

  hide(): void {
    if (!this.visible) {
      return;
    }
    this.plane.setEnabled(false);
    this.visible = false;
    pulseControllerSoft('xr');
    this.onToggled?.(false);
  }

  private placeInFront(): void {
    if (!this.cam) {
      return;
    }
    this.placeInFrontFor(this.cam);
  }

  sync(turnMode: TurnMode, snapAngle: SnapAngle): void {
    const turnLabel = this.turnButton?.textBlock;
    if (turnLabel) {
      turnLabel.text = turnMode === 'snap' ? 'TURN: SNAP' : 'TURN: SMOOTH';
    }
    const angleLabel = this.angleButton?.textBlock;
    if (angleLabel) {
      angleLabel.text = `ANGLE: ${snapAngle}°`;
    }
    this.refreshCounts();
  }

  setThemeSelection(theme: {
    primary: number;
    secondary: number;
    tertiary: number;
  }): void {
    this.theme = {...theme};
    for (const entry of this.swatches) {
      entry.button.thickness =
        this.theme[entry.slot] === entry.index ? 3 : 1;
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  debugToggle(): void {
    this.toggle();
  }

  debugPlaceInFrontOfActiveCamera(): void {
    const cam = this.scene.activeCamera;
    if (!cam) {
      return;
    }
    this.placeInFrontFor(cam);
    this.refreshCounts();
    this.plane.setEnabled(true);
    this.visible = true;
  }

  private placeInFrontFor(cam: Camera): void {
    const forward = cam.getDirection(Vector3.Forward());
    const position = cam.position.add(forward.scale(MENU_DISTANCE));
    position.y -= MENU_DROP;
    this.plane.position.copyFrom(position);
    this.plane.lookAt(cam.position);
    this.plane.rotate(Axis.Y, Math.PI, Space.LOCAL);
  }
}
