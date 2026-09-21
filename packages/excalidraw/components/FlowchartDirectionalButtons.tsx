import React from "react";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import {
  getElementAbsoluteCoords,
  type LinkDirection,
} from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useApp, useExcalidrawAppState } from "./App";

import "./FlowchartDirectionalButtons.scss";

import type { AppState } from "../types";

const DIRECTIONS: LinkDirection[] = ["up", "right", "down", "left"];

const getButtonPosition = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  appState: AppState,
  direction: LinkDirection,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const scenePosition = {
    up: { sceneX: (x1 + x2) / 2, sceneY: y1 },
    right: { sceneX: x2, sceneY: (y1 + y2) / 2 },
    down: { sceneX: (x1 + x2) / 2, sceneY: y2 },
    left: { sceneX: x1, sceneY: (y1 + y2) / 2 },
  }[direction];
  const { x, y } = sceneCoordsToViewportCoords(scenePosition, appState);

  return {
    left: x - appState.offsetLeft,
    top: y - appState.offsetTop,
  };
};

export const FlowchartDirectionalButtons = ({
  element,
  elementsMap,
}: {
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
}) => {
  const app = useApp();
  const appState = useExcalidrawAppState();

  if (
    element.locked ||
    (element.type !== "rectangle" && element.type !== "diamond") ||
    appState.contextMenu ||
    appState.newElement ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.openMenu ||
    appState.viewModeEnabled
  ) {
    return null;
  }

  return (
    <div
      className="excalidraw-flowchart-directional-buttons"
      role="group"
      aria-label="Add connected flowchart node"
    >
      {DIRECTIONS.map((direction) => {
        const position = getButtonPosition(
          element,
          elementsMap,
          appState,
          direction,
        );
        const label = `Add node ${direction}`;

        return (
          <button
            key={direction}
            className={`excalidraw-flowchart-directional-button excalidraw-flowchart-directional-button--${direction}`}
            data-testid={`flowchart-add-${direction}`}
            style={position}
            type="button"
            aria-label={label}
            title={label}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              app.flowchart.addNodeFromDirection(element, direction);
            }}
          >
            +
          </button>
        );
      })}
    </div>
  );
};
