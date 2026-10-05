import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type {
  ExcalidrawDiamondElement,
  ExcalidrawRectangleElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { LinkDirection } from "@excalidraw/element";

import "./FlowchartDirectionalButtons.scss";

import type { AppState } from "../types";

const CONTROL_OFFSET = 19;
const TOP_CONTROL_OFFSET = 42;

type FlowchartNode =
  | (NonDeletedExcalidrawElement & ExcalidrawRectangleElement)
  | (NonDeletedExcalidrawElement & ExcalidrawDiamondElement);

const DIRECTIONS: LinkDirection[] = ["up", "right", "down", "left"];

const getControlPosition = (
  element: FlowchartNode,
  direction: LinkDirection,
  appState: AppState,
) => {
  const { x, y, width, height, angle } = element;
  const center = pointFrom(x + width / 2, y + height / 2);
  const anchor = {
    up: pointFrom(center[0], y),
    right: pointFrom(x + width, center[1]),
    down: pointFrom(center[0], y + height),
    left: pointFrom(x, center[1]),
  }[direction];
  const normal = {
    up: pointFrom(0, -1),
    right: pointFrom(1, 0),
    down: pointFrom(0, 1),
    left: pointFrom(-1, 0),
  }[direction];

  const rotatedAnchor = pointRotateRads(anchor, center, angle);
  const rotatedNormal = pointRotateRads(normal, pointFrom(0, 0), angle);
  const viewport = sceneCoordsToViewportCoords(
    { sceneX: rotatedAnchor[0], sceneY: rotatedAnchor[1] },
    appState,
  );
  const controlOffset =
    direction === "up" ? TOP_CONTROL_OFFSET : CONTROL_OFFSET;

  return {
    left: viewport.x - appState.offsetLeft + rotatedNormal[0] * controlOffset,
    top: viewport.y - appState.offsetTop + rotatedNormal[1] * controlOffset,
  };
};

const DIRECTION_LABELS: Record<LinkDirection, string> = {
  up: "Add shape above",
  right: "Add shape to the right",
  down: "Add shape below",
  left: "Add shape to the left",
};

export const FlowchartDirectionalButtons = ({
  element,
  appState,
  onCreate,
}: {
  element: FlowchartNode;
  appState: AppState;
  onCreate: (direction: LinkDirection) => void;
}) => (
  <div className="excalidraw-flowchart-directional-controls">
    {DIRECTIONS.map((direction) => {
      const position = getControlPosition(element, direction, appState);
      const label = DIRECTION_LABELS[direction];

      return (
        <button
          aria-label={label}
          className="excalidraw-flowchart-directional-control"
          key={direction}
          style={position}
          title={label}
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onCreate(direction);
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      );
    })}
  </div>
);
