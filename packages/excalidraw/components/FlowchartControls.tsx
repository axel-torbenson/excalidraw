import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { aabbForElement, type LinkDirection } from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawFlowchartNodeElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { IconButton } from "./IconButton";
import { PlusIcon } from "./icons";

import "./FlowchartControls.scss";

import type { AppClassProperties, AppState } from "../types";

const CONTROL_OFFSET = 24;

const DIRECTIONS: readonly {
  direction: LinkDirection;
  label: string;
}[] = [
  { direction: "up", label: "Create flowchart node above" },
  { direction: "right", label: "Create flowchart node to the right" },
  { direction: "down", label: "Create flowchart node below" },
  { direction: "left", label: "Create flowchart node to the left" },
];

export const FlowchartControls = ({
  app,
  appState,
  element,
  elementsMap,
}: {
  app: AppClassProperties;
  appState: AppState;
  element: NonDeleted<ExcalidrawFlowchartNodeElement>;
  elementsMap: ElementsMap;
}) => {
  const [x1, y1, x2, y2] = aabbForElement(element, elementsMap);
  const center = sceneCoordsToViewportCoords(
    {
      sceneX: x1 + (x2 - x1) / 2,
      sceneY: y1 + (y2 - y1) / 2,
    },
    appState,
  );
  const topLeft = sceneCoordsToViewportCoords(
    { sceneX: x1, sceneY: y1 },
    appState,
  );
  const bottomRight = sceneCoordsToViewportCoords(
    { sceneX: x2, sceneY: y2 },
    appState,
  );

  const positions: Record<LinkDirection, { left: number; top: number }> = {
    up: {
      left: 0,
      top: topLeft.y - center.y - CONTROL_OFFSET,
    },
    right: {
      left: bottomRight.x - center.x + CONTROL_OFFSET,
      top: 0,
    },
    down: {
      left: 0,
      top: bottomRight.y - center.y + CONTROL_OFFSET,
    },
    left: {
      left: topLeft.x - center.x - CONTROL_OFFSET,
      top: 0,
    },
  };

  return (
    <div
      className="flowchart-direction-controls"
      style={{
        left: `${center.x - appState.offsetLeft}px`,
        top: `${center.y - appState.offsetTop}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {DIRECTIONS.map(({ direction, label }) => (
        <IconButton
          key={direction}
          type="button"
          size="small"
          className="flowchart-direction-controls__button"
          icon={PlusIcon}
          title={label}
          aria-label={label}
          data-testid={`flowchart-create-${direction}`}
          style={positions[direction]}
          onClick={() => app.flowchart.createNode(element, direction)}
        />
      ))}
    </div>
  );
};
