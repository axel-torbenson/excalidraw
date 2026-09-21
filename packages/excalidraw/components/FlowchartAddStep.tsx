import React, { useEffect, useRef, useState } from "react";

import {
  addNewNodes,
  CaptureUpdateAction,
  isFlowchartNodeElement,
  makeNextSelectedElementIds,
  type LinkDirection,
} from "@excalidraw/element";

import { ElementCanvasButtons } from "./ElementCanvasButtons";
import { useApp, useExcalidrawAppState } from "./App";

import "./FlowchartAddStep.scss";

const DIRECTIONS: readonly {
  direction: LinkDirection;
  label: string;
  symbol: string;
}[] = [
  { direction: "up", label: "Up", symbol: "↑" },
  { direction: "right", label: "Right", symbol: "→" },
  { direction: "down", label: "Down", symbol: "↓" },
  { direction: "left", label: "Left", symbol: "←" },
];

export const FlowchartAddStep = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedElements = app.scene.getSelectedElements(appState);
  const selectedElement =
    selectedElements.length === 1 &&
    isFlowchartNodeElement(selectedElements[0]) &&
    (selectedElements[0].type === "rectangle" ||
      selectedElements[0].type === "diamond")
      ? selectedElements[0]
      : null;

  const selectedElementId = selectedElement?.id;

  useEffect(() => {
    if (!selectedElementId) {
      setIsOpen(false);
      return;
    }

    const ownerDocument = app.ownerDocument;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    ownerDocument.addEventListener("pointerdown", onPointerDown);
    ownerDocument.addEventListener("keydown", onKeyDown);
    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown);
      ownerDocument.removeEventListener("keydown", onKeyDown);
    };
  }, [app.ownerDocument, selectedElementId]);

  if (!selectedElement) {
    return null;
  }

  const addStep = (direction: LinkDirection) => {
    const { nodes } = addNewNodes(
      selectedElement,
      app.state,
      direction,
      app.scene,
      1,
    );
    const newNode = nodes.find(isFlowchartNodeElement);
    if (!newNode) {
      return;
    }

    app.insertNewElements(nodes);
    app.setAppState(
      (prevState) => ({
        selectedElementIds: makeNextSelectedElementIds(
          { [newNode.id]: true },
          prevState,
        ),
      }),
      () => {
        app.syncActionResult({
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        app.focusContainer();
      },
    );
    setIsOpen(false);
  };

  return (
    <ElementCanvasButtons
      element={selectedElement}
      elementsMap={app.scene.getNonDeletedElementsMap()}
    >
      <div className="flowchart-add-step" ref={menuRef}>
        <button
          className="flowchart-add-step__trigger"
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Add step"
          onClick={() => setIsOpen((open) => !open)}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span aria-hidden="true">+</span>
          <span>Add step</span>
        </button>
        {isOpen && (
          <div
            className="flowchart-add-step__menu"
            role="menu"
            aria-label="Add step direction"
          >
            {DIRECTIONS.map(({ direction, label, symbol }) => (
              <button
                key={direction}
                className="flowchart-add-step__direction"
                type="button"
                role="menuitem"
                aria-label={`Add step ${label.toLowerCase()}`}
                onClick={() => addStep(direction)}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <span aria-hidden="true">{symbol}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </ElementCanvasButtons>
  );
};
