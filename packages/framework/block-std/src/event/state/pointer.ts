import { UIEventState } from '../base.js';

type PointerEventStateOptions = {
  event: PointerEvent;
  rect: DOMRect;
  startX: number;
  startY: number;
  last: PointerEventState | null;
  cumulativeParentScale: number;
};

type Point = { x: number; y: number };

export class PointerEventState extends UIEventState {
  override type = 'pointerState';

  raw: PointerEvent;
  point: Point;
  containerOffset: Point;
  start: Point;
  delta: Point;
  keys: {
    shift: boolean;
    cmd: boolean;
    alt: boolean;
  };
  button: number;
  dragging: boolean;
  cumulativeParentScale: number;
  pressure: number;

  get x() {
    return this.point.x;
  }

  get y() {
    return this.point.y;
  }

  constructor({
    event,
    rect,
    startX,
    startY,
    last,
    cumulativeParentScale,
  }: PointerEventStateOptions) {
    super(event);

    const offsetX = (event.clientX - rect.left) / cumulativeParentScale;
    const offsetY = (event.clientY - rect.top) / cumulativeParentScale;

    this.raw = event;
    this.point = { x: offsetX, y: offsetY };
    this.containerOffset = { x: rect.left, y: rect.top };
    this.start = { x: startX, y: startY };
    this.delta = last
      ? { x: offsetX - last.point.x, y: offsetY - last.point.y }
      : { x: 0, y: 0 };
    this.keys = {
      shift: event.shiftKey,
      cmd: event.metaKey || event.ctrlKey,
      alt: event.altKey,
    };
    this.button = last?.button || event.button;
    this.dragging = !!last;
    this.cumulativeParentScale = cumulativeParentScale;
    this.pressure = event.pressure;
  }
}

declare global {
  interface BlockSuiteUIEventState {
    pointerState: PointerEventState;
  }
}
