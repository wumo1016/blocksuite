import { DisposableGroup, Slot } from '@blocksuite/global/utils';

import { PathFinder } from '../utils/index.js';
import {
  type UIEventHandler,
  UIEventState,
  UIEventStateContext,
} from './base.js';
import { ClipboardControl } from './control/clipboard.js';
import { KeyboardControl } from './control/keyboard.js';
import { PointerControl } from './control/pointer.js';
import { RangeControl } from './control/range.js';
import { EventScopeSourceType, EventSourceState } from './state/source.js';
import { toLowerCase } from './utils.js';

const bypassEventNames = [
  'beforeInput',

  'blur',
  'focus',
  'drop',
  'contextMenu',
  'wheel',
] as const;

const eventNames = [
  'click',
  'doubleClick',
  'tripleClick',

  'pointerDown',
  'pointerMove',
  'pointerUp',
  'pointerOut',

  'dragStart',
  'dragMove',
  'dragEnd',

  'keyDown',
  'keyUp',

  'selectionChange',
  'compositionStart',
  'compositionUpdate',
  'compositionEnd',

  'cut',
  'copy',
  'paste',

  ...bypassEventNames,
] as const;

export type EventName = (typeof eventNames)[number];
export type EventOptions = {
  flavour?: string;
  path?: string[];
};
export type EventHandlerRunner = {
  fn: UIEventHandler;
  flavour?: string;
  path?: string[];
};

export type EventScope = {
  runners: EventHandlerRunner[];
  flavours: string[];
  paths: string[][];
};

export class UIEventDispatcher {
  disposables = new DisposableGroup();

  slots = {
    parentScaleChanged: new Slot<number>(),
    editorHostPanned: new Slot(),
  };

  private _handlersMap = Object.fromEntries(
    eventNames.map((name): [EventName, Array<EventHandlerRunner>] => [name, []])
  ) as Record<EventName, Array<EventHandlerRunner>>;

  private _pointerControl: PointerControl;
  private _keyboardControl: KeyboardControl;
  private _rangeControl: RangeControl;
  private _clipboardControl: ClipboardControl;

  private _active = false;
  get active() {
    return this._active;
  }

  constructor(public std: BlockSuite.Std) {
    this._pointerControl = new PointerControl(this);
    this._keyboardControl = new KeyboardControl(this);
    this._rangeControl = new RangeControl(this);
    this._clipboardControl = new ClipboardControl(this);
  }

  get cumulativeParentScale() {
    return this._pointerControl.cumulativeParentScale;
  }

  mount() {
    if (this.disposables.disposed) {
      this.disposables = new DisposableGroup();
    }
    this._bindEvents();
  }

  unmount() {
    this.disposables.dispose();
  }

  get host() {
    return this.std.host;
  }

  run(name: EventName, context: UIEventStateContext, scope?: EventScope) {
    if (!this.active) return;

    const sourceState = context.get('sourceState');
    if (!scope) {
      scope = this._getEventScope(name, sourceState);
      if (!scope) {
        return;
      }
    }

    for (const runner of scope.runners) {
      const { fn } = runner;
      const result = fn(context);
      if (result) {
        return;
      }
    }
  }

  add(name: EventName, handler: UIEventHandler, options?: EventOptions) {
    const runner: EventHandlerRunner = {
      fn: handler,
      flavour: options?.flavour,
      path: options?.path,
    };
    this._handlersMap[name].unshift(runner);
    return () => {
      if (this._handlersMap[name].includes(runner)) {
        this._handlersMap[name] = this._handlersMap[name].filter(
          x => x !== runner
        );
      }
    };
  }

  bindHotkey = (...args: Parameters<KeyboardControl['bindHotkey']>) =>
    this._keyboardControl.bindHotkey(...args);

  private get _currentSelections() {
    return this.std.selection.value;
  }

  private _getEventScope(name: EventName, state: EventSourceState) {
    const handlers = this._handlersMap[name];
    if (!handlers) return;

    let output: EventScope | undefined;

    switch (state.sourceType) {
      case EventScopeSourceType.Selection: {
        output = this._buildEventScopeBySelection(name);
        break;
      }
      case EventScopeSourceType.Target: {
        output = this._buildEventScopeByTarget(
          name,
          state.event.target as Node
        );
        break;
      }
      default: {
        throw new Error(`Unknown event scope source: ${state.sourceType}`);
      }
    }

    return output;
  }

  buildEventScope(
    name: EventName,
    flavours: string[],
    paths: string[][]
  ): EventScope | undefined {
    const handlers = this._handlersMap[name];
    if (!handlers) return;

    const globalEvents = handlers.filter(
      handler => handler.flavour === undefined && handler.path === undefined
    );

    const pathEvents = handlers.filter(handler => {
      const _path = handler.path;
      if (_path === undefined) return false;
      return paths.some(path => PathFinder.includes(path, _path));
    });

    const flavourEvents = handlers.filter(
      handler => handler.flavour && flavours.includes(handler.flavour)
    );

    return {
      runners: pathEvents.concat(flavourEvents).concat(globalEvents),
      flavours,
      paths,
    };
  }

  private _buildEventScopeByTarget(name: EventName, target: Node) {
    const handlers = this._handlersMap[name];
    if (!handlers) return;

    const path = this.std.view.getNodeView(target)?.path;
    if (!path) {
      return this._buildEventScopeBySelection(name);
    }

    const flavours = path
      .map(blockId => {
        return this.std.doc.getBlockById(blockId)?.flavour;
      })
      .filter((flavour): flavour is string => {
        return !!flavour;
      })
      .reverse();

    return this.buildEventScope(name, flavours, [path]);
  }

  private _buildEventScopeBySelection(name: EventName) {
    const handlers = this._handlersMap[name];
    if (!handlers) return;

    const selections = this._currentSelections;
    const seen: Record<string, boolean> = {};

    const flavours = selections
      .map(selection => selection.path)
      .flatMap(path => {
        return path.map(blockId => {
          return this.std.doc.getBlockById(blockId)?.flavour;
        });
      })
      .filter((flavour): flavour is string => {
        if (!flavour) return false;
        if (seen[flavour]) return false;
        seen[flavour] = true;
        return true;
      })
      .reverse();

    const paths = selections.map(selection => selection.path);

    return this.buildEventScope(name, flavours, paths);
  }

  private _bindEvents() {
    bypassEventNames.forEach(eventName => {
      this.disposables.addFromEvent(
        this.host,
        toLowerCase(eventName),
        event => {
          this.run(
            eventName,
            UIEventStateContext.from(
              new UIEventState(event),
              new EventSourceState({
                event,
                sourceType: EventScopeSourceType.Selection,
              })
            )
          );
        }
      );
    });

    this._pointerControl.listen();
    this._keyboardControl.listen();
    this._rangeControl.listen();
    this._clipboardControl.listen();

    this.disposables.addFromEvent(this.host, 'pointerdown', () => {
      this._active = true;
    });
    this.disposables.addFromEvent(this.host, 'click', () => {
      this._active = true;
    });
    this.disposables.addFromEvent(this.host, 'focusin', () => {
      this._active = true;
    });
    this.disposables.addFromEvent(this.host, 'focusout', e => {
      if (e.relatedTarget && !this.host.contains(e.relatedTarget as Node)) {
        this._active = false;
      }
    });
    this.disposables.addFromEvent(this.host, 'mouseenter', () => {
      this._active = true;
    });
    this.disposables.addFromEvent(this.host, 'mouseleave', () => {
      if (
        !document.activeElement ||
        !this.host.contains(document.activeElement)
      ) {
        this._active = false;
      }
    });
  }
}
