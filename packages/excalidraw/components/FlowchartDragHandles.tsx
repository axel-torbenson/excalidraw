import { useEffect, useRef, useState } from "react";

import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import type {
  ExcalidrawFlowchartNodeElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { LinkDirection } from "@excalidraw/element";

import { t } from "../i18n";

import "./FlowchartDragHandles.scss";

import type App from "./App";

const DIRECTIONS = ["up", "right", "down", "left"] as const;
const SYMBOLS = { up: "↑", right: "→", down: "↓", left: "←" };
const DRAG_THRESHOLD = 6;

export const FlowchartDragHandles = ({
  app,
  selectedElements,
}: {
  app: App;
  selectedElements: readonly NonDeletedExcalidrawElement[];
}) => {
  const [dragging, setDragging] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const state = app.state;
  const source = selectedElements[0];
  if (
    selectedElements.length !== 1 ||
    !source ||
    (source.type !== "rectangle" && source.type !== "diamond") ||
    source.locked ||
    state.viewModeEnabled ||
    state.newElement ||
    state.resizingElement ||
    state.isResizing ||
    state.isRotating ||
    state.selectedElementsAreBeingDragged ||
    state.editingTextElement ||
    state.editingGroupId ||
    state.activeTool.type !== "selection" ||
    state.contextMenu ||
    state.openMenu ||
    !app.isInteractionEnabled() ||
    !app.isDefaultUIEnabled()
  ) {
    return null;
  }

  const [x1, y1, x2, y2] = getCommonBounds([source]);
  const positions = {
    up: [(x1 + x2) / 2, y1],
    right: [x2, (y1 + y2) / 2],
    down: [(x1 + x2) / 2, y2],
    left: [x1, (y1 + y2) / 2],
  };

  const start = (
    event: React.PointerEvent<HTMLButtonElement>,
    direction: LinkDirection,
    node: NonDeleted<ExcalidrawFlowchartNodeElement>,
  ) => {
    if (event.button !== 0 || cleanup.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const handle = event.currentTarget;
    handle.setPointerCapture?.(pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    const document = app.ownerDocument;

    const positionAt = (pointer: PointerEvent) => {
      const { x, y } = viewportCoordsToSceneCoords(
        { clientX: pointer.clientX, clientY: pointer.clientY },
        app.state,
      );
      return { x: x - node.width / 2, y: y - node.height / 2 };
    };
    const stop = () => {
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", cancel, true);
      document.removeEventListener("keydown", key, true);
      app.ownerWindow.removeEventListener("blur", cancel);
      if (handle.hasPointerCapture?.(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
      cleanup.current = null;
      setDragging(false);
      app.flowchart.clearPointerPreview();
    };
    const cancel = () => stop();
    const key = (keyboard: KeyboardEvent) => {
      if (keyboard.key === "Escape") {
        keyboard.preventDefault();
        keyboard.stopImmediatePropagation();
        stop();
      }
    };
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) {
        return;
      }
      pointer.preventDefault();
      pointer.stopImmediatePropagation();
      moved ||=
        Math.hypot(pointer.clientX - startX, pointer.clientY - startY) >=
        DRAG_THRESHOLD;
      if (moved) {
        setDragging(true);
        app.flowchart.previewPointerNode(node, direction, positionAt(pointer));
      }
    };
    const end = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) {
        return;
      }
      pointer.preventDefault();
      pointer.stopImmediatePropagation();
      const distance = Math.hypot(
        pointer.clientX - startX,
        pointer.clientY - startY,
      );
      const { x, y } = viewportCoordsToSceneCoords(
        { clientX: pointer.clientX, clientY: pointer.clientY },
        app.state,
      );
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2;
      stop();
      // A deliberate click is a shortcut to the default placement. Once a
      // drag starts, returning to the handle/source cancels instead.
      if (!moved && distance < DRAG_THRESHOLD && !inside) {
        app.flowchart.commitPointerNode(node, direction);
      } else if (moved && distance >= DRAG_THRESHOLD && !inside) {
        app.flowchart.commitPointerNode(node, direction, positionAt(pointer));
      }
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", cancel, true);
    document.addEventListener("keydown", key, true);
    app.ownerWindow.addEventListener("blur", cancel);
    cleanup.current = stop;
  };

  return (
    <div
      className="flowchart-drag-handles"
      style={{ visibility: dragging ? "hidden" : undefined }}
    >
      {DIRECTIONS.map((direction) => {
        const [sceneX, sceneY] = positions[direction];
        const { x, y } = sceneCoordsToViewportCoords({ sceneX, sceneY }, state);
        const offsetX =
          direction === "left" ? -36 : direction === "right" ? 36 : 0;
        const offsetY =
          direction === "up" ? -36 : direction === "down" ? 36 : 0;
        return (
          <button
            key={direction}
            type="button"
            className="flowchart-drag-handle"
            data-testid={`flowchart-drag-${direction}`}
            aria-label={t(`labels.flowchartDrag.${direction}`)}
            title={t(`labels.flowchartDrag.${direction}`)}
            style={{
              left: x - state.offsetLeft + offsetX,
              top: y - state.offsetTop + offsetY,
            }}
            onPointerDown={(event) => start(event, direction, source)}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                app.flowchart.commitPointerNode(source, direction);
              }
            }}
          >
            {SYMBOLS[direction]}
          </button>
        );
      })}
    </div>
  );
};
