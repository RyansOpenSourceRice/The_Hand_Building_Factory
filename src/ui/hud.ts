import {
  AdvancedDynamicTexture,
  Button,
  Control,
  TextBlock,
} from '@babylonjs/gui';

const FONT = '\'Atkinson Hyperlegible\', system-ui, sans-serif';

export class Hud {
  private readonly live: HTMLElement | null;
  private readonly statusBlock: TextBlock;
  private readonly xrNote: TextBlock;

  constructor(onReset: () => void) {
    this.live = document.getElementById('live-status');

    const adt = AdvancedDynamicTexture.CreateFullscreenUI('ui', true);

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
    adt.addControl(title);

    this.statusBlock = new TextBlock('status');
    this.statusBlock.fontFamily = FONT;
    this.statusBlock.fontSize = '24px';
    this.statusBlock.color = '#c9d4ff';
    this.statusBlock.resizeToFit = true;
    this.statusBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.statusBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.statusBlock.top = '10%';
    adt.addControl(this.statusBlock);

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
    adt.addControl(hint);

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
    adt.addControl(this.xrNote);

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
    reset.onPointerClickObservable.add(() => onReset());
    adt.addControl(reset);
  }

  setStatus(text: string): void {
    this.statusBlock.text = text;
    if (this.live) {
      this.live.textContent = text;
    }
  }

  setReady(mode: 'xr' | 'desktop'): void {
    if (this.live) {
      this.live.textContent = `ready:${mode}`;
    }
  }

  showDesktopOnly(): void {
    this.xrNote.isVisible = true;
  }

  hideDesktopOnly(): void {
    this.xrNote.isVisible = false;
  }
}
