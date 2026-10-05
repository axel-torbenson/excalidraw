import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { LinkDirection } from "@excalidraw/element";

import "./FlowchartCreationHandles.scss";

import type { AppState } from "../types";

const HANDLE_OFFSET = 20;
const TOP_HANDLE_OFFSET = 58;
const DIRECTIONS: LinkDirection[] = ["up", "right", "down", "left"];

export const FlowchartCreationHandles = ({
  appState,
  element,
  elementsMap,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  isDragging,
}: {
  appState: AppState;
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
  onPointerDown: (
    direction: LinkDirection,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  isDragging: boolean;
}) => {
  const [x1, y1, x2, y2] = getCommonBounds([element], elementsMap);
  const zoom = appState.zoom.value;
  const positions: Record<LinkDirection, { x: number; y: number }> = {
    up: { x: (x1 + x2) / 2, y: y1 - TOP_HANDLE_OFFSET / zoom },
    right: { x: x2 + HANDLE_OFFSET / zoom, y: (y1 + y2) / 2 },
    down: { x: (x1 + x2) / 2, y: y2 + HANDLE_OFFSET / zoom },
    left: { x: x1 - HANDLE_OFFSET / zoom, y: (y1 + y2) / 2 },
  };

  return (
    <div
      className="excalidraw-flowchart-create-handles"
      style={{ visibility: isDragging ? "hidden" : "visible" }}
    >
      {DIRECTIONS.map((direction) => {
        const { x, y } = sceneCoordsToViewportCoords(
          { sceneX: positions[direction].x, sceneY: positions[direction].y },
          appState,
        );

        return (
          <button
            key={direction}
            aria-label={`Create flowchart node ${direction}`}
            className="excalidraw-flowchart-create-handle"
            data-testid={`flowchart-create-handle-${direction}`}
            type="button"
            style={{
              left: `${x - appState.offsetLeft}px`,
              top: `${y - appState.offsetTop}px`,
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              try {
                event.currentTarget.setPointerCapture?.(event.pointerId);
              } catch {
                // Pointer capture may be unavailable in test and older browsers.
              }
              onPointerDown(direction, event);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 20 20"
              className={`excalidraw-flowchart-create-handle__icon excalidraw-flowchart-create-handle__icon--${direction}`}
            >
              <path d="M10 17V3m0 0L5 8m5-5 5 5" />
            </svg>
          </button>
        );
      })}
    </div>
  );
};
