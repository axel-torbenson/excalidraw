import { useEffect } from "react";

import {
  getCommonBounds,
  getTransformHandles,
  type LinkDirection,
} from "@excalidraw/element";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

import "./FlowchartControls.scss";

import type App from "./App";

const DIRECTIONS = ["up", "right", "down", "left"] as const;

export const FlowchartControls = ({
  app,
  selectedElements,
}: {
  app: App;
  selectedElements: readonly NonDeletedExcalidrawElement[];
}) => {
  const { state } = app;
  const node = selectedElements.length === 1 ? selectedElements[0] : null;
  const visible =
    node &&
    (node.type === "rectangle" || node.type === "diamond") &&
    !node.locked &&
    !state.viewModeEnabled &&
    !state.selectedElementsAreBeingDragged &&
    !state.isResizing &&
    !state.isRotating &&
    !state.editingTextElement &&
    !state.newElement &&
    state.cursorButton === "up" &&
    state.activeTool.type === "selection";

  useEffect(() => {
    return () => app.flowchart.clearPointerPreview();
  }, [app, node?.id, visible]);

  if (!visible || !node) {
    return null;
  }

  // Use the rotated selection bounds, not the unrotated shape dimensions.
  // Keep screen-space targets clear of every actual transform handle (the
  // rotation handle can be on any side of a rotated shape).
  const [x1, y1, x2, y2] = getCommonBounds([node]);
  const topLeft = sceneCoordsToViewportCoords(
    { sceneX: x1, sceneY: y1 },
    state,
  );
  const bottomRight = sceneCoordsToViewportCoords(
    { sceneX: x2, sceneY: y2 },
    state,
  );
  const left = topLeft.x - state.offsetLeft;
  const top = topLeft.y - state.offsetTop;
  const right = bottomRight.x - state.offsetLeft;
  const bottom = bottomRight.y - state.offsetTop;
  const positions: Record<LinkDirection, { left: number; top: number }> = {
    up: { left: (left + right) / 2, top: top - 64 },
    right: { left: right + 38, top: (top + bottom) / 2 },
    down: { left: (left + right) / 2, top: bottom + 38 },
    left: { left: left - 38, top: (top + bottom) / 2 },
  };
  const handles = getTransformHandles(
    node,
    state.zoom,
    app.scene.getNonDeletedElementsMap(),
    state.lastPointerDownWith,
  );
  for (const handle of Object.values(handles)) {
    if (!handle) {
      continue;
    }
    const [x, y, width, height] = handle;
    const corner = sceneCoordsToViewportCoords({ sceneX: x, sceneY: y }, state);
    const handleLeft = corner.x - state.offsetLeft;
    const handleTop = corner.y - state.offsetTop;
    // Radius 14px plus 6px of separation, regardless of zoom/pointer type.
    positions.left.left = Math.min(positions.left.left, handleLeft - 20);
    positions.up.top = Math.min(positions.up.top, handleTop - 20);
    positions.right.left = Math.max(
      positions.right.left,
      handleLeft + width * state.zoom.value + 20,
    );
    positions.down.top = Math.max(
      positions.down.top,
      handleTop + height * state.zoom.value + 20,
    );
  }

  return (
    <div className="FlowchartControls">
      {DIRECTIONS.map((direction) => {
        const label = t(`flowchart.addNode.${direction}`);
        return (
          <button
            key={direction}
            type="button"
            className="FlowchartControls__button"
            data-testid={`flowchart-add-${direction}`}
            style={positions[direction]}
            aria-label={label}
            title={`${label} — ${getShortcutKey("CtrlOrCmd")} + ${
              { up: "↑", right: "→", down: "↓", left: "←" }[direction]
            }`}
            onPointerEnter={() => app.flowchart.previewDirection(direction)}
            onPointerLeave={app.flowchart.clearPointerPreview}
            onFocus={() => app.flowchart.previewDirection(direction)}
            onBlur={app.flowchart.clearPointerPreview}
            onPointerDown={(event) => {
              // Do not let this hit start a canvas selection or element drag.
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerUp={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              // Preserve native button activation without also invoking the
              // canvas's Enter-to-edit or Space-to-pan shortcuts.
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              app.flowchart.createInDirection(direction);
              app.focusContainer();
            }}
          >
            <span aria-hidden="true">+</span>
          </button>
        );
      })}
    </div>
  );
};
