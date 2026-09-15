import { useEffect, useRef, useState } from "react";

import { KEYS } from "@excalidraw/common";
import {
  isFlowchartNodeElement,
  type LinkDirection,
} from "@excalidraw/element";

import type {
  ExcalidrawDiamondElement,
  ExcalidrawRectangleElement,
  ElementsMap,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { ElementCanvasButtons } from "./ElementCanvasButtons";
import { ArrowIcon, PlusIcon } from "./icons";

import "./FlowchartAddStep.scss";

import type App from "./App";

const DIRECTIONS: readonly {
  direction: LinkDirection;
  label: string;
  rotation: number;
}[] = [
  { direction: "up", label: "above", rotation: -90 },
  { direction: "right", label: "to the right", rotation: 0 },
  { direction: "down", label: "below", rotation: 90 },
  { direction: "left", label: "to the left", rotation: 180 },
];

const isAddStepElement = (
  element: NonDeletedExcalidrawElement,
): element is NonDeleted<
  ExcalidrawRectangleElement | ExcalidrawDiamondElement
> =>
  isFlowchartNodeElement(element) &&
  (element.type === "rectangle" || element.type === "diamond") &&
  !element.locked;

const FlowchartAddStep = ({
  app,
  element,
  elementsMap,
}: {
  app: App;
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isEligible =
    isAddStepElement(element) &&
    !app.state.viewModeEnabled &&
    !app.state.zenModeEnabled &&
    app.state.activeTool.type === "selection" &&
    !app.state.editingTextElement &&
    !app.state.openDialog &&
    !app.state.showHyperlinkPopup &&
    !app.state.newElement &&
    !app.state.selectionElement &&
    !app.state.resizingElement &&
    !app.state.isRotating &&
    !app.state.selectedElementsAreBeingDragged;

  useEffect(() => {
    if (!isOpen || !isEligible) {
      return;
    }

    const ownerDocument = app.ownerDocument;
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const dismissOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    ownerDocument.addEventListener("pointerdown", dismissOnPointerDown);
    ownerDocument.addEventListener("keydown", dismissOnKeyDown, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", dismissOnPointerDown);
      ownerDocument.removeEventListener("keydown", dismissOnKeyDown, true);
    };
  }, [app, isEligible, isOpen]);

  if (!isEligible || !isAddStepElement(element)) {
    return null;
  }

  const onDirectionSelect = (direction: LinkDirection) => {
    app.flowchart.addStep(element, direction);
    setIsOpen(false);
  };

  return (
    <ElementCanvasButtons element={element} elementsMap={elementsMap}>
      <div
        ref={rootRef}
        className="flowchart-add-step"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          ref={triggerRef}
          className="flowchart-add-step__trigger"
          type="button"
          aria-expanded={isOpen}
          aria-controls="flowchart-add-step-directions"
          aria-label="Add step"
          data-testid="flowchart-add-step"
          title="Add step"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen((open) => !open);
          }}
        >
          <span className="flowchart-add-step__plus">{PlusIcon}</span>
          <span>Add step</span>
        </button>
        {isOpen && (
          <div
            id="flowchart-add-step-directions"
            className="flowchart-add-step__directions"
            role="group"
            aria-label="Choose direction for new step"
          >
            {DIRECTIONS.map(({ direction, label, rotation }) => (
              <button
                key={direction}
                className="flowchart-add-step__direction"
                type="button"
                aria-label={`Add step ${label}`}
                data-testid={`flowchart-add-step-${direction}`}
                title={`Add step ${label}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDirectionSelect(direction);
                }}
              >
                <span
                  className="flowchart-add-step__direction-icon"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  {ArrowIcon}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </ElementCanvasButtons>
  );
};

export default FlowchartAddStep;
