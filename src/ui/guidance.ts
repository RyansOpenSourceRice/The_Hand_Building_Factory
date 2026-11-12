import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
} from '@babylonjs/gui';
import {Axis, Space} from '@babylonjs/core/Maths/math.axis';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import type {Scene} from '@babylonjs/core/scene';

const FONT = '\'Atkinson Hyperlegible\', system-ui, sans-serif';
const BOARD_WIDTH = 0.64;
const BOARD_HEIGHT = 0.27;

export type GuidanceText = {
  title: string;
  detail: string;
  progress: string;
};

export class Guidance {
  private readonly plane: Mesh;
  private readonly adt: AdvancedDynamicTexture;
  private readonly titleBlock: TextBlock;
  private readonly detailBlock: TextBlock;
  private readonly progressBlock: TextBlock;
  private text: GuidanceText = {title: '', detail: '', progress: ''};

  constructor(scene: Scene) {
    this.plane = MeshBuilder.CreatePlane(
        'guidanceBoard',
        {
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          sideOrientation: Mesh.DOUBLESIDE,
        },
        scene,
    );
    this.plane.position.set(0, 1.9, -0.04);
    this.plane.lookAt(new Vector3(0, 1.55, 1.2));
    this.plane.rotate(Axis.Y, Math.PI, Space.LOCAL);
    this.plane.isPickable = false;
    this.adt = AdvancedDynamicTexture.CreateForMesh(
        this.plane, 640, 280);

    const backing = new Rectangle('guidance-backing');
    backing.width = '608px';
    backing.height = '248px';
    backing.background = 'rgba(14, 20, 34, 0.92)';
    backing.color = 'rgba(242, 194, 48, 0.9)';
    backing.thickness = 2;
    backing.cornerRadius = 10;
    this.adt.addControl(backing);

    const rule = new Rectangle('guidance-rule');
    rule.width = '560px';
    rule.height = '2px';
    rule.background = '#f2c230';
    rule.color = 'transparent';
    rule.thickness = 0;
    rule.top = '-96px';
    this.adt.addControl(rule);

    this.titleBlock = new TextBlock('guidance-title', '');
    this.titleBlock.fontFamily = FONT;
    this.titleBlock.fontSize = '30px';
    this.titleBlock.fontWeight = '700';
    this.titleBlock.color = '#f2f4ff';
    this.titleBlock.resizeToFit = true;
    this.titleBlock.top = '-58px';
    this.adt.addControl(this.titleBlock);

    this.detailBlock = new TextBlock('guidance-detail', '');
    this.detailBlock.fontFamily = FONT;
    this.detailBlock.fontSize = '21px';
    this.detailBlock.color = '#c9d4ff';
    this.detailBlock.resizeToFit = true;
    this.detailBlock.top = '14px';
    this.adt.addControl(this.detailBlock);

    this.progressBlock = new TextBlock('guidance-progress', '');
    this.progressBlock.fontFamily = FONT;
    this.progressBlock.fontSize = '18px';
    this.progressBlock.color = '#f2c230';
    this.progressBlock.resizeToFit = true;
    this.progressBlock.top = '68px';
    this.adt.addControl(this.progressBlock);

    this.plane.setEnabled(false);
  }

  set(text: GuidanceText): void {
    if (text.title === this.text.title &&
        text.detail === this.text.detail &&
        text.progress === this.text.progress) {
      return;
    }
    this.text = text;
    this.titleBlock.text = text.title;
    this.detailBlock.text = text.detail;
    this.progressBlock.text = text.progress;
  }

  setVisible(visible: boolean): void {
    if (this.plane.isEnabled() !== visible) {
      this.plane.setEnabled(visible);
    }
  }

  debugText(): GuidanceText & {visible: boolean} {
    return {...this.text, visible: this.plane.isEnabled()};
  }

  isVisible(): boolean {
    return this.plane.isEnabled();
  }
}
