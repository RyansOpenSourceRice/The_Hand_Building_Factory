import {
  AdvancedDynamicTexture,
  Button,
  Control,
  TextBlock,
} from '@babylonjs/gui';
import type {SnapAngle, TurnMode} from '../game/settings';

const FONT = '\'Atkinson Hyperlegible\', system-ui, sans-serif';

export type HudActions = {
  reset: () => void;
  undo: () => void;
  redo: () => void;
  cycleTurnMode: () => void;
  cycleSnapAngle: () => void;
};

export class Hud {
  private readonly live: HTMLElement | null;
  private readonly statusBlock: TextBlock;
  private readonly xrNote: TextBlock;
  private enterVrButton: Button | null = null;
  private enterVrHandler: (() => void) | null = null;
  private turnButton: Button | null = null;
  private angleButton: Button | null = null;

  private readonly adt: AdvancedDynamicTexture;

  constructor(actions: HudActions) {
    this.live = document.getElementById('live-status');

    this.adt = AdvancedDynamicTexture.CreateFullscreenUI('ui', true);

    const title = new TextBlock('title');
    title.text = 'HANDS ON!';
    title.fontFamily = FONT;
    title.fontSize = '44px';
    title.fontWeight = '700';
    title.color = '#f2f4ff';
    title.resizeToFit = true;
    title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.top = '3%';
    this.adt.addControl(title);

    this.statusBlock = new TextBlock('status');
    this.statusBlock.fontFamily = FONT;
    this.statusBlock.fontSize = '24px';
    this.statusBlock.color = '#c9d4ff';
    this.statusBlock.resizeToFit = true;
    this.statusBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.statusBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.statusBlock.top = '10%';
    this.adt.addControl(this.statusBlock);

    const hint = new TextBlock('hint');
    hint.text =
        'Trigger to grab - release inside the blue outline - grip to reset';
    hint.fontFamily = FONT;
    hint.fontSize = '18px';
    hint.color = '#8f9cc4';
    hint.resizeToFit = true;
    hint.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    hint.top = '-6%';
    this.adt.addControl(hint);

    this.xrNote = new TextBlock('xrNote');
    this.xrNote.text =
        'Desktop preview. Open this page on a Meta Quest 3 to play in VR.';
    this.xrNote.fontFamily = FONT;
    this.xrNote.fontSize = '16px';
    this.xrNote.color = '#6d7aa6';
    this.xrNote.resizeToFit = true;
    this.xrNote.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.xrNote.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.xrNote.left = '3%';
    this.xrNote.top = '3%';
    this.xrNote.isVisible = false;
    this.adt.addControl(this.xrNote);

    const reset = Button.CreateSimpleButton('reset', 'RESET');
    reset.fontFamily = FONT;
    reset.fontSize = '20px';
    reset.color = '#f2f4ff';
    reset.background = 'rgba(35, 45, 80, 0.85)';
    reset.cornerRadius = 8;
    reset.width = '110px';
    reset.height = '44px';
    reset.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    reset.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    reset.left = '-3%';
    reset.top = '-6%';
    reset.onPointerClickObservable.add(() => actions.reset());
    this.adt.addControl(reset);

    const redo = Button.CreateSimpleButton('redo', 'REDO');
    redo.fontFamily = FONT;
    redo.fontSize = '20px';
    redo.color = '#f2f4ff';
    redo.background = 'rgba(35, 45, 80, 0.85)';
    redo.cornerRadius = 8;
    redo.width = '90px';
    redo.height = '44px';
    redo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    redo.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    redo.left = '-14%';
    redo.top = '-6%';
    redo.onPointerClickObservable.add(() => actions.redo());
    this.adt.addControl(redo);

    const undo = Button.CreateSimpleButton('undo', 'UNDO');
    undo.fontFamily = FONT;
    undo.fontSize = '20px';
    undo.color = '#f2f4ff';
    undo.background = 'rgba(35, 45, 80, 0.85)';
    undo.cornerRadius = 8;
    undo.width = '90px';
    undo.height = '44px';
    undo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    undo.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    undo.left = '-25%';
    undo.top = '-6%';
    undo.onPointerClickObservable.add(() => actions.undo());
    this.adt.addControl(undo);

    const turn = Button.CreateSimpleButton('turn', 'TURN: SNAP');
    turn.fontFamily = FONT;
    turn.fontSize = '17px';
    turn.color = '#f2f4ff';
    turn.background = 'rgba(35, 45, 80, 0.85)';
    turn.cornerRadius = 8;
    turn.width = '130px';
    turn.height = '44px';
    turn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    turn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    turn.left = '3%';
    turn.top = '-6%';
    turn.onPointerClickObservable.add(() => actions.cycleTurnMode());
    this.adt.addControl(turn);
    this.turnButton = turn;

    const angle = Button.CreateSimpleButton('angle', 'ANGLE: 45°');
    angle.fontFamily = FONT;
    angle.fontSize = '17px';
    angle.color = '#f2f4ff';
    angle.background = 'rgba(35, 45, 80, 0.85)';
    angle.cornerRadius = 8;
    angle.width = '104px';
    angle.height = '44px';
    angle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    angle.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    angle.left = '14%';
    angle.top = '-6%';
    angle.onPointerClickObservable.add(() => actions.cycleSnapAngle());
    this.adt.addControl(angle);
    this.angleButton = angle;
  }

  setStatus(text: string): void {
    this.statusBlock.text = text;
    if (this.live) {
      this.live.textContent = text;
    }
  }

  setEnterVr(handler: () => void): void {
    this.enterVrHandler = handler;
    if (this.enterVrButton) {
      this.enterVrButton.isVisible = true;
      return;
    }
    const enter = Button.CreateSimpleButton('enterVr', 'ENTER VR');
    enter.fontFamily = FONT;
    enter.fontSize = '26px';
    enter.color = '#f2f4ff';
    enter.background = 'rgba(35, 45, 80, 0.9)';
    enter.cornerRadius = 12;
    enter.width = '240px';
    enter.height = '64px';
    enter.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    enter.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    enter.top = '-14%';
    enter.onPointerClickObservable.add(() => this.enterVrHandler?.());
    this.adt.addControl(enter);
    this.enterVrButton = enter;
  }

  showEnterVr(): void {
    if (this.enterVrButton) {
      this.enterVrButton.isVisible = true;
    }
  }

  hideEnterVr(): void {
    if (this.enterVrButton) {
      this.enterVrButton.isVisible = false;
    }
  }

  setReady(mode: 'xr' | 'desktop'): void {
    if (this.live) {
      this.live.setAttribute('data-ready', mode);
      this.live.setAttribute(
          'data-xr',
          mode === 'xr' ? 'present' : 'missing',
      );
    }
  }

  setSettings(turnMode: TurnMode, snapAngle: SnapAngle): void {
    const turnLabel = this.turnButton?.textBlock;
    if (turnLabel) {
      turnLabel.text =
          turnMode === 'snap' ? 'TURN: SNAP' : 'TURN: SMOOTH';
    }
    const angleLabel = this.angleButton?.textBlock;
    if (angleLabel) {
      angleLabel.text = `ANGLE: ${snapAngle}°`;
    }
    if (this.live) {
      this.live.setAttribute('data-turn', turnMode);
      this.live.setAttribute('data-angle', String(snapAngle));
    }
  }

  setCameraInfo(x: number, z: number): void {
    if (this.live) {
      this.live.setAttribute('data-cam', `${x.toFixed(2)},${z.toFixed(2)}`);
    }
  }

  setPartInfo(info: string): void {
    if (this.live) {
      this.live.setAttribute('data-part', info);
    }
  }

  showDesktopOnly(uaQuest = false): void {
    this.xrNote.isVisible = true;
    if (this.live) {
      this.live.setAttribute('data-ua-quest', uaQuest ? 'yes' : 'no');
      this.live.setAttribute(
          'data-secure',
          window.isSecureContext ? 'yes' : 'no',
      );
    }
  }

  hideDesktopOnly(): void {
    this.xrNote.isVisible = false;
    if (this.live) {
      this.live.removeAttribute('data-ua-quest');
      this.live.removeAttribute('data-secure');
    }
  }
}
