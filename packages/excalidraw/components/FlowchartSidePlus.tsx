import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import {
  getElementAbsoluteCoords,
  isFlowchartNodeElement,
} from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { LinkDirection } from "@excalidraw/element";

import { PlusIcon } from "./icons";

import "./FlowchartSidePlus.scss";

import type { AppState } from "../types";

type FlowchartSidePlusProps = {
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
  appState: AppState;
  onCreate(direction: LinkDirection): void;
};

const getPosition = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  appState: AppState,
  direction: LinkDirection,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const scenePoint = {
    left: { sceneX: x1, sceneY: (y1 + y2) / 2 },
    right: { sceneX: x2, sceneY: (y1 + y2) / 2 },
    up: { sceneX: (x1 + x2) / 2, sceneY: y1 },
    down: { sceneX: (x1 + x2) / 2, sceneY: y2 },
  }[direction];
  const viewportPoint = sceneCoordsToViewportCoords(scenePoint, appState);

  return {
    left: viewportPoint.x - appState.offsetLeft,
    top: viewportPoint.y - appState.offsetTop,
  };
};

export const FlowchartSidePlus = ({
  element,
  elementsMap,
  appState,
  onCreate,
}: FlowchartSidePlusProps) => {
  if (
    !isFlowchartNodeElement(element) ||
    (element.type !== "rectangle" && element.type !== "diamond") ||
    element.locked
  ) {
    return null;
  }

  return (
    <div
      className="excalidraw-flowchart-side-plus"
      aria-label="Flowchart controls"
    >
      {(["up", "right", "down", "left"] as const).map((direction) => {
        const position = getPosition(element, elementsMap, appState, direction);
        const label = {
          up: "Create flowchart node above",
          right: "Create flowchart node to the right",
          down: "Create flowchart node below",
          left: "Create flowchart node to the left",
        }[direction];

        return (
          <button
            key={direction}
            className={`excalidraw-flowchart-side-plus__button excalidraw-flowchart-side-plus__button--${direction}`}
            type="button"
            style={{
              left: position.left,
              top: position.top,
            }}
            aria-label={label}
            title={label}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onCreate(direction);
            }}
          >
            {PlusIcon}
          </button>
        );
      })}
    </div>
  );
};
