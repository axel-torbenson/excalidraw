import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getCommonBounds, getSelectedElements } from "@excalidraw/element";

import type { LinkDirection } from "@excalidraw/element";

import { useApp, useExcalidrawAppState } from "./App";

import "./FlowchartDirectionButtons.scss";

const DIRECTIONS: LinkDirection[] = ["up", "right", "down", "left"];

/** Contextual controls only; nothing is added to the exported canvas. */
export const FlowchartDirectionButtons = () => {
  const app = useApp();
  const state = useExcalidrawAppState();
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const selected = getSelectedElements(elementsMap, state);
  const node = selected[0];
  if (
    selected.length !== 1 ||
    !node ||
    node.locked ||
    (node.type !== "rectangle" && node.type !== "diamond") ||
    state.activeTool.type !== "selection" ||
    state.viewModeEnabled ||
    state.zenModeEnabled ||
    state.editingTextElement ||
    state.newElement ||
    state.resizingElement ||
    state.isRotating ||
    state.selectedElementsAreBeingDragged ||
    state.selectionElement ||
    state.contextMenu ||
    state.openMenu ||
    app.flowchart.isCreatingChart
  ) {
    return null;
  }

  // Common bounds include rotation; the viewport transform includes zoom/pan.
  const [x1, y1, x2, y2] = getCommonBounds([node]);
  const positions = {
    up: [(x1 + x2) / 2, y1],
    right: [x2, (y1 + y2) / 2],
    down: [(x1 + x2) / 2, y2],
    left: [x1, (y1 + y2) / 2],
  };

  return (
    <div
      className="flowchart-direction-buttons"
      role="group"
      aria-label="Continue flowchart"
    >
      {DIRECTIONS.map((direction) => {
        const [sceneX, sceneY] = positions[direction];
        const { x, y } = sceneCoordsToViewportCoords({ sceneX, sceneY }, state);
        const offset = 28;
        return (
          <button
            key={direction}
            type="button"
            className="flowchart-direction-button"
            aria-label={`Add connected shape ${direction}`}
            title={`Add connected shape ${direction} · Enter to label`}
            style={{
              left:
                x -
                state.offsetLeft +
                (direction === "left"
                  ? -offset
                  : direction === "right"
                  ? offset
                  : 0),
              top:
                y -
                state.offsetTop +
                (direction === "up"
                  ? -offset
                  : direction === "down"
                  ? offset
                  : 0),
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              // Native button activation must not also start canvas text editing.
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
              }
            }}
            onClick={() => app.flowchart.createNode(direction)}
          >
            <span aria-hidden="true">+</span>
          </button>
        );
      })}
    </div>
  );
};
