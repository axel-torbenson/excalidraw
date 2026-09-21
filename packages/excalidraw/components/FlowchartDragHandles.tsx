import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type {
  ExcalidrawDiamondElement,
  ExcalidrawRectangleElement,
  NonDeleted,
} from "@excalidraw/element/types";

import type App from "./App";

type FlowchartHandleElement =
  | ExcalidrawRectangleElement
  | ExcalidrawDiamondElement;

type Direction = "up" | "right" | "down" | "left";

const HANDLE_SIZE = 18;
const HANDLE_OFFSET = 12;

const handleLabels: Record<Direction, string> = {
  up: "Create flowchart node above",
  right: "Create flowchart node to the right",
  down: "Create flowchart node below",
  left: "Create flowchart node to the left",
};

export const FlowchartDragHandles = ({
  app,
  element,
}: {
  app: App;
  element: NonDeleted<FlowchartHandleElement>;
}) => {
  const topLeft = sceneCoordsToViewportCoords(
    { sceneX: element.x, sceneY: element.y },
    app.state,
  );
  const zoom = app.state.zoom.value;
  const left = topLeft.x - app.state.offsetLeft;
  const top = topLeft.y - app.state.offsetTop;
  const width = element.width * zoom;
  const height = element.height * zoom;

  const positions: Record<Direction, { left: number; top: number }> = {
    up: {
      left: left + width / 2 - HANDLE_SIZE / 2,
      top: top - HANDLE_OFFSET - HANDLE_SIZE,
    },
    right: {
      left: left + width + HANDLE_OFFSET,
      top: top + height / 2 - HANDLE_SIZE / 2,
    },
    down: {
      left: left + width / 2 - HANDLE_SIZE / 2,
      top: top + height + HANDLE_OFFSET,
    },
    left: {
      left: left - HANDLE_OFFSET - HANDLE_SIZE,
      top: top + height / 2 - HANDLE_SIZE / 2,
    },
  };

  return (
    <div
      className="excalidraw-flowchart-drag-handles"
      aria-label="Flowchart creation handles"
    >
      {(Object.keys(positions) as Direction[]).map((direction) => (
        <button
          key={direction}
          type="button"
          className={`excalidraw-flowchart-drag-handle excalidraw-flowchart-drag-handle--${direction}`}
          aria-label={handleLabels[direction]}
          style={positions[direction]}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            app.flowchart.beginPointerDrag(
              element,
              direction,
              event.nativeEvent,
            );
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      ))}
    </div>
  );
};
