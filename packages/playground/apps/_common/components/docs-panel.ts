import { CloseIcon, createDefaultDoc } from '@blocksuite/blocks';
import { ShadowlessElement, WithDisposable } from '@blocksuite/lit';
import type { AffineEditorContainer } from '@blocksuite/presets';
import type { DocCollection } from '@blocksuite/store';
import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

@customElement('docs-panel')
export class DocsPanel extends WithDisposable(ShadowlessElement) {
  static override styles = css`
    docs-panel {
      display: flex;
      flex-direction: column;
      width: 100%;
      background-color: var(--affine-background-secondary-color);
      font-family: var(--affine-font-family);
      height: 100%;
      padding: 12px;
      gap: 4px;
    }
    .doc-item:hover .delete-doc-icon {
      display: flex;
    }
    .delete-doc-icon {
      display: none;
      padding: 2px;
      border-radius: 4px;
    }
    .delete-doc-icon:hover {
      background-color: var(--affine-hover-color);
    }
    .delete-doc-icon svg {
      width: 14px;
      height: 14px;
      color: var(--affine-secondary-color);
      fill: var(--affine-secondary-color);
    }
    .new-doc-button {
      margin-bottom: 16px;
      border: 1px solid var(--affine-border-color);
      border-radius: 4px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .new-doc-button:hover {
      background-color: var(--affine-hover-color);
    }
  `;
  @property({ attribute: false })
  editor!: AffineEditorContainer;

  public override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(
      this.editor.doc.collection.slots.docUpdated.on(() => {
        this.requestUpdate();
      })
    );
  }

  createDoc = () => {
    createDocBlock(this.editor.doc.collection);
  };

  protected override render(): unknown {
    const collection = this.editor.doc.collection;
    const docs = [...collection.docs.values()];
    return html`
      <div @click="${this.createDoc}" class="new-doc-button">New Doc</div>
      ${repeat(
        docs,
        v => v.id,
        doc => {
          const style = styleMap({
            backgroundColor:
              this.editor.doc.id === doc.id
                ? 'var(--affine-hover-color)'
                : undefined,
            padding: '4px 4px 4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
          });
          const click = () => {
            this.editor.doc = doc;
            this.editor.doc.load();
            this.editor.doc.resetHistory();
            this.requestUpdate();
          };
          const deleteDoc = () => {
            collection.removeDoc(doc.id);
            // When delete a doc, we need to set the editor doc to the first remaining doc
            const docs = Array.from(collection.docs.values());
            this.editor.doc = docs[0];
            this.requestUpdate();
          };
          return html`<div class="doc-item" @click="${click}" style="${style}">
            ${doc.meta?.title || 'Untitled'}
            <div @click="${deleteDoc}" class="delete-doc-icon">
              ${CloseIcon}
            </div>
          </div>`;
        }
      )}
    `;
  }
}

function createDocBlock(collection: DocCollection) {
  const id = collection.idGenerator();
  createDefaultDoc(collection, { id });
}

declare global {
  interface HTMLElementTagNameMap {
    'docs-panel': DocsPanel;
  }
}
