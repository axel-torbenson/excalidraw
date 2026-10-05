import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getElementBounds, type LinkDirection } from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import "./FlowchartPlusControls.scss";

import type { AppState } from "../types";

const CONTROL_SIZE = 28;
const CONTROL_GAP = 8;
type ControlLabel =
  | "createFlowchartNodeAbove"
  | "createFlowchartNodeRight"
  | "createFlowchartNodeBelow"
  | "createFlowchartNodeLeft";

const directions: {
  direction: LinkDirection;
  label: ControlLabel;
  position: "top" | "right" | "bottom" | "left";
}[] = [
  { direction: "up", label: "createFlowchartNodeAbove", position: "top" },
  { direction: "right", label: "createFlowchartNodeRight", position: "right" },
  { direction: "down", label: "createFlowchartNodeBelow", position: "bottom" },
  { direction: "left", label: "createFlowchartNodeLeft", position: "left" },
];

export const FlowchartPlusControls = ({
  appState,
  element,
  elementsMap,
  onCreate,
}: {
  appState: AppState;
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
  onCreate: (direction: LinkDirection) => void;
}) => {
  if (
    (element.type !== "rectangle" && element.type !== "diamond") ||
    element.locked ||
    appState.viewModeEnabled ||
    appState.activeTool.type !== "selection" ||
    appState.selectionElement ||
    appState.newElement ||
    appState.selectedElementsAreBeingDragged ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.editingTextElement ||
    appState.croppingElementId ||
    appState.activeLockedId ||
    appState.contextMenu ||
    appState.openMenu ||
    appState.openDialog
  ) {
    return null;
  }

  // Controls follow the rotated element's axis-aligned bounds. Their
  // directions remain canvas-axis aligned to match flowchart placement.
  const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  const points = {
    top: { x: (x1 + x2) / 2, y: y1 },
    right: { x: x2, y: (y1 + y2) / 2 },
    bottom: { x: (x1 + x2) / 2, y: y2 },
    left: { x: x1, y: (y1 + y2) / 2 },
  };

  return (
    <div className="excalidraw-flowchart-plus-controls">
      {directions.map(({ direction, label, position }) => {
        const point = points[position];
        const { x, y } = sceneCoordsToViewportCoords(
          { sceneX: point.x, sceneY: point.y },
          appState,
        );
        const centerX = x - appState.offsetLeft;
        const centerY = y - appState.offsetTop;
        const coordinates = {
          top: {
            left: centerX - CONTROL_SIZE / 2,
            top: centerY - CONTROL_SIZE - CONTROL_GAP,
          },
          right: {
            left: centerX + CONTROL_GAP,
            top: centerY - CONTROL_SIZE / 2,
          },
          bottom: {
            left: centerX - CONTROL_SIZE / 2,
            top: centerY + CONTROL_GAP,
          },
          left: {
            left: centerX - CONTROL_SIZE - CONTROL_GAP,
            top: centerY - CONTROL_SIZE / 2,
          },
        }[position];

        return (
          <button
            key={direction}
            type="button"
            className={`excalidraw-flowchart-plus-controls__button is-${position}`}
            style={coordinates}
            aria-label={t(`labels.${label}`)}
            title={t(`labels.${label}`)}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onCreate(direction);
            }}
          >
            +
          </button>
        );
      })}
    </div>
  );
};
