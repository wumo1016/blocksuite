import { assertExists } from '@blocksuite/global/utils';
import type { EditorHost } from '@blocksuite/lit';

import { type EdgelessModel } from '../../../_common/types.js';
import { isTopLevelBlock } from '../../../root-block/edgeless/utils/query.js';
import type { Renderer } from '../../../surface-block/canvas-renderer/renderer.js';
import { Bound } from '../../../surface-block/utils/bound.js';
import type { SurfaceRefBlockComponent } from '../../../surface-ref-block/surface-ref-block.js';

export const edgelessToBlob = async (
  host: EditorHost,
  options: {
    surfaceRefBlock: SurfaceRefBlockComponent;
    surfaceRenderer: Renderer;
    edgelessElement: EdgelessModel;
    blockContainer: HTMLElement;
  }
): Promise<Blob> => {
  const { edgelessElement, blockContainer } = options;
  const rootService = host.spec.getService('affine:page');
  const exportManager = rootService.exportManager;
  const bound = Bound.deserialize(edgelessElement.xywh);
  const isBlock = isTopLevelBlock(edgelessElement);

  return exportManager
    .edgelessToCanvas(
      options.surfaceRenderer,
      bound,
      model =>
        blockContainer.querySelector(
          `[data-portal-reference-block-id="${model.id}"]`
        ),
      undefined,
      isBlock ? [edgelessElement] : undefined,
      isBlock ? undefined : [edgelessElement],
      { zoom: options.surfaceRenderer.zoom }
    )
    .then(canvas => {
      assertExists(canvas);
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          blob => (blob ? resolve(blob) : reject(null)),
          'image/png'
        );
      });
    });
};

export const writeImageBlobToClipboard = async (blob: Blob) => {
  // @ts-ignore
  if (window.apis?.clipboard?.copyAsImageFromString) {
    // @ts-ignore
    await window.apis.clipboard?.copyAsImageFromString(blob);
  } else {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  }
};
