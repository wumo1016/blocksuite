import './field.js';

import { ShadowlessElement, WithDisposable } from '@blocksuite/lit';
import { css, nothing, unsafeCSS } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit/static-html.js';

import { popFilterableSimpleMenu } from '../../../_common/components/menu/index.js';
import { renderUniLit } from '../../../_common/components/uni-component/uni-component.js';
import { PlusIcon } from '../../../_common/icons/index.js';
import { dataViewCommonStyle } from '../css-variable.js';
import type { DataViewManager } from '../data-view-manager.js';
import type { DetailSlotProps } from '../datasource/base.js';
import { DetailSelection } from './selection.js';

const styles = css`
  ${unsafeCSS(dataViewCommonStyle('affine-data-view-record-detail'))}
  affine-data-view-record-detail {
    display: flex;
    flex-direction: column;
    padding: 0 36px;
    gap: 12px;
    height: 100%;
  }

  .add-property {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--data-view-cell-text-size);
    font-style: normal;
    font-weight: 400;
    line-height: var(--data-view-cell-text-line-height);
    color: var(--affine-text-secondary-color);
    border-radius: 4px;
    padding: 4px;
    cursor: pointer;
  }

  .add-property:hover {
    background-color: var(--affine-hover-color);
  }

  .add-property .icon {
    display: flex;
    align-items: center;
  }

  .add-property .icon svg {
    fill: var(--affine-icon-color);
    width: 20px;
    height: 20px;
  }
`;

@customElement('affine-data-view-record-detail')
export class RecordDetail extends WithDisposable(ShadowlessElement) {
  static override styles = styles;

  @property({ attribute: false })
  view!: DataViewManager;
  @property({ attribute: false })
  rowId!: string;
  selection = new DetailSelection(this);

  private get readonly() {
    return this.view.readonly;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(
      this.view.slots.update.on(() => {
        this.requestUpdate();
      })
    );
    this.disposables.addFromEvent(this, 'click', e => {
      e.stopPropagation();
      this.selection.selection = undefined;
    });
    //FIXME: simulate as a widget
    this.dataset.widgetId = 'affine-detail-widget';
  }

  @query('.add-property')
  addPropertyButton!: HTMLElement;
  _clickAddProperty = () => {
    popFilterableSimpleMenu(
      this.addPropertyButton,
      this.view.allColumnConfig.map(config => {
        return {
          type: 'action',
          name: config.name,
          icon: html` <uni-lit
            .uni="${this.view.getIcon(config.type)}"
          ></uni-lit>`,
          select: () => {
            this.view.columnAdd('end', config.type);
          },
        };
      })
    );
  };

  private get columns() {
    return this.view.detailColumns.map(id => this.view.columnGet(id));
  }

  override render() {
    const columns = this.columns;

    return html`
      ${this.renderHeader()}
      ${repeat(
        columns,
        v => v,
        column => {
          return html` <affine-data-view-record-field
            .view="${this.view}"
            .column="${column}"
            .rowId="${this.rowId}"
            data-column-id="${column.id}"
          ></affine-data-view-record-field>`;
        }
      )}
      ${!this.readonly
        ? html`<div class="add-property" @click="${this._clickAddProperty}">
            <div class="icon">${PlusIcon}</div>
            Add Property
          </div>`
        : nothing}
    `;
  }

  private renderHeader() {
    const header = this.view.detailSlots.header;
    if (header) {
      const props: DetailSlotProps = {
        view: this.view,
        rowId: this.rowId,
      };
      return renderUniLit(header, props);
    }
    return undefined;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-record-detail': RecordDetail;
  }
}
