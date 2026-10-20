import { useEffect, useRef } from "react";

import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import type { LinkDirection } from "@excalidraw/element";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import "./FlowchartDragHandles.scss";

import type App from "./App";

const directions = ["up", "right", "down", "left"] as const;
const symbols = { up: "↑", right: "→", down: "↓", left: "←" };

export const getFlowchartDragDirection = (
  dx: number,
  dy: number,
): LinkDirection =>
  Math.abs(dx) >= Math.abs(dy)
    ? dx < 0
      ? "left"
      : "right"
    : dy < 0
    ? "up"
    : "down";

export const canShowFlowchartDragHandles = (
  app: App,
  selected: readonly NonDeletedExcalidrawElement[],
) =>
  selected.length === 1 &&
  (selected[0].type === "rectangle" || selected[0].type === "diamond") &&
  !selected[0].locked &&
  selected[0].angle === 0 &&
  selected[0].groupIds.length === 0 &&
  app.isInteractionEnabled() &&
  app.state.activeTool.type === "selection" &&
  !app.state.editingTextElement &&
  !app.state.selectedElementsAreBeingDragged &&
  !app.state.isResizing &&
  !app.state.isRotating &&
  !app.state.openDialog &&
  !app.state.contextMenu;

/** Four small targets appear only on a single eligible selected node. */
export const FlowchartDragHandles = ({
  app,
  node,
}: {
  app: App;
  node: NonDeletedExcalidrawElement;
}) => {
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => () => app.flowchart.cancelDrag(), [app, node.id]);

  return (
    <div className="flowchart-drag-handles">
      {directions.map((direction) => {
        const { x, y } = sceneCoordsToViewportCoords(
          {
            sceneX:
              node.x +
              (direction === "left"
                ? 0
                : direction === "right"
                ? node.width
                : node.width / 2),
            sceneY:
              node.y +
              (direction === "up"
                ? 0
                : direction === "down"
                ? node.height
                : node.height / 2),
          },
          app.state,
        );
        const offset = 26;
        return (
          <button
            key={direction}
            type="button"
            className="flowchart-drag-handle"
            aria-label={`Drag to connect ${direction}`}
            title="Drag to preview a connected shape. Release to place; Escape to cancel. Double-click the new shape to label."
            style={{
              left:
                x -
                app.state.offsetLeft +
                (direction === "left"
                  ? -offset
                  : direction === "right"
                  ? offset
                  : 0),
              top:
                y -
                app.state.offsetTop +
                (direction === "up"
                  ? -offset
                  : direction === "down"
                  ? offset
                  : 0),
            }}
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0 || drag.current) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              };
              app.flowchart.beginDrag(node);
              app.focusContainer();
            }}
            onPointerMove={(event) => {
              if (drag.current?.pointerId !== event.pointerId) {
                return;
              }
              event.stopPropagation();
              // Threshold is in screen pixels, independent of zoom.
              if (
                Math.hypot(
                  event.clientX - drag.current.x,
                  event.clientY - drag.current.y,
                ) < 8
              ) {
                return;
              }
              const point = viewportCoordsToSceneCoords(event, app.state);
              app.flowchart.previewDrag(
                getFlowchartDragDirection(
                  point.x - node.x - node.width / 2,
                  point.y - node.y - node.height / 2,
                ),
              );
            }}
            onPointerUp={(event) => {
              if (drag.current?.pointerId === event.pointerId) {
                event.stopPropagation();
                drag.current = null;
                app.flowchart.finishDrag();
              }
            }}
            onPointerCancel={() => {
              drag.current = null;
              app.flowchart.cancelDrag();
            }}
            onLostPointerCapture={() => {
              if (drag.current) {
                drag.current = null;
                app.flowchart.cancelDrag();
              }
            }}
          >
            {symbols[direction]}
          </button>
        );
      })}
    </div>
  );
};
