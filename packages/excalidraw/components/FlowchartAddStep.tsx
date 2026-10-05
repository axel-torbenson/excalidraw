import { useEffect, useRef, useState } from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getElementAbsoluteCoords } from "@excalidraw/element";

import type { LinkDirection } from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import { useExcalidrawAppState } from "./App";

import "./FlowchartAddStep.scss";

import type { AppState } from "../types";

const DIRECTIONS: LinkDirection[] = ["up", "right", "down", "left"];
const DIRECTION_ARROWS: Record<LinkDirection, string> = {
  up: "↑",
  right: "→",
  down: "↓",
  left: "←",
};
const getDirectionLabel = (direction: LinkDirection) =>
  t(`labels.flowchart.direction_${direction}`);

const getToolbarCoords = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
  isPickerOpen: boolean,
) => {
  const [x1, y1, x2] = getElementAbsoluteCoords(element, elementsMap);
  const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
    { sceneX: (x1 + x2) / 2, sceneY: y1 },
    appState,
  );
  const width = isPickerOpen ? 176 : 112;
  const height = isPickerOpen ? 88 : 40;
  const x = Math.max(
    8,
    Math.min(
      viewportX - appState.offsetLeft - width / 2,
      appState.width - width - 8,
    ),
  );
  const aboveY = viewportY - appState.offsetTop - height - 8;
  const desiredY = aboveY >= 8 ? aboveY : viewportY - appState.offsetTop + 8;
  const y = Math.max(
    8,
    Math.min(Math.max(8, appState.height - height - 8), desiredY),
  );

  return { x, y };
};

export const FlowchartAddStep = ({
  element,
  elementsMap,
  onAddStep,
}: {
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
  onAddStep: (direction: LinkDirection) => void;
}) => {
  const appState = useExcalidrawAppState();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [direction, setDirection] = useState<LinkDirection>("right");
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const directionButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = DIRECTIONS.indexOf(direction);

  useEffect(() => {
    if (isPickerOpen) {
      directionButtonRefs.current[selectedIndex]?.focus();
    }
  }, [isPickerOpen, selectedIndex]);

  const commitStep = (nextDirection: LinkDirection) => {
    setIsPickerOpen(false);
    onAddStep(nextDirection);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!isPickerOpen) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsPickerOpen(false);
      addButtonRef.current?.focus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commitStep(direction);
      return;
    }
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft"
    ) {
      event.preventDefault();
      const nextDirection = event.key.slice(5).toLowerCase() as LinkDirection;
      setDirection(nextDirection);
      directionButtonRefs.current[DIRECTIONS.indexOf(nextDirection)]?.focus();
    }
  };

  const { x, y } = getToolbarCoords(
    element,
    appState,
    elementsMap,
    isPickerOpen,
  );

  if (
    appState.contextMenu ||
    appState.selectedElementsAreBeingDragged ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.editingTextElement ||
    appState.newElement ||
    appState.selectionElement ||
    appState.viewModeEnabled ||
    appState.openMenu
  ) {
    return null;
  }

  return (
    <div
      className="excalidraw-flowchart-add-step"
      style={{ left: `${x}px`, top: `${y}px` }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={addButtonRef}
        className="excalidraw-flowchart-add-step__button"
        type="button"
        aria-haspopup="true"
        aria-expanded={isPickerOpen}
        aria-label={t("labels.flowchart.addStep")}
        title={t("labels.flowchart.addStep")}
        onClick={() => {
          setDirection("right");
          setIsPickerOpen((open) => !open);
        }}
      >
        <span aria-hidden="true">+</span>
        {t("labels.flowchart.addStepShort")}
      </button>
      {isPickerOpen && (
        <div
          className="excalidraw-flowchart-add-step__picker"
          role="group"
          aria-label={t("labels.flowchart.chooseDirection")}
        >
          {DIRECTIONS.map((item, index) => (
            <button
              key={item}
              ref={(ref) => {
                directionButtonRefs.current[index] = ref;
              }}
              className="excalidraw-flowchart-add-step__direction"
              type="button"
              aria-label={t("labels.flowchart.addStepDirection", {
                direction: getDirectionLabel(item),
              })}
              aria-pressed={direction === item}
              title={t("labels.flowchart.addStepDirectionTooltip", {
                direction: getDirectionLabel(item),
              })}
              tabIndex={direction === item ? 0 : -1}
              onFocus={() => setDirection(item)}
              onClick={() => commitStep(item)}
            >
              <span aria-hidden="true">{DIRECTION_ARROWS[item]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
