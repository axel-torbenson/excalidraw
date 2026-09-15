import React, { useEffect, useRef, useState } from "react";

import {
  EVENT,
  KEYS,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  isFlowchartNodeElement,
  type LinkDirection,
} from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useApp, useExcalidrawAppState } from "./App";

import "./FlowchartHandles.scss";

type DragState = {
  elementId: NonDeletedExcalidrawElement["id"];
  pointerId: number;
  direction: LinkDirection;
  target: HTMLButtonElement;
};

const DIRECTIONS: readonly {
  direction: LinkDirection;
  symbol: string;
  label: string;
}[] = [
  { direction: "up", symbol: "↑", label: "Create node above" },
  { direction: "right", symbol: "→", label: "Create node to the right" },
  { direction: "down", symbol: "↓", label: "Create node below" },
  { direction: "left", symbol: "←", label: "Create node to the left" },
];

const HANDLE_SIZE = 26;
const HANDLE_GAP = 16;
const MINIMUM_NODE_GAP = 32;

const getNodePositionForPointer = (
  element: NonDeletedExcalidrawElement,
  direction: LinkDirection,
  scenePointer: { x: number; y: number },
) => {
  const gap = MINIMUM_NODE_GAP;
  const x = scenePointer.x - element.width / 2;
  const y = scenePointer.y - element.height / 2;

  switch (direction) {
    case "up":
      return {
        x,
        y: Math.min(y, element.y - gap - element.height),
      };
    case "right":
      return {
        x: Math.max(x, element.x + element.width + gap),
        y,
      };
    case "down":
      return {
        x,
        y: Math.max(y, element.y + element.height + gap),
      };
    case "left":
      return {
        x: Math.min(x, element.x - gap - element.width),
        y,
      };
  }
};

const releasePointerCapture = (activeDrag: DragState) => {
  if (
    activeDrag.target.hasPointerCapture?.(activeDrag.pointerId) &&
    activeDrag.target.releasePointerCapture
  ) {
    activeDrag.target.releasePointerCapture(activeDrag.pointerId);
  }
};

const FlowchartHandles = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const cancelDrag = () => {
    if (!dragRef.current) {
      return;
    }
    releasePointerCapture(dragRef.current);
    app.flowchart.cancelDragPreview();
    dragRef.current = null;
    setDrag(null);
  };

  useEffect(() => {
    const ownerWindow = app.ownerWindow;
    const onKeyDown = (event: KeyboardEvent) => {
      const activeDrag = dragRef.current;
      if (event.key === KEYS.ESCAPE && activeDrag) {
        event.preventDefault();
        event.stopPropagation();
        releasePointerCapture(activeDrag);
        app.flowchart.cancelDragPreview();
        dragRef.current = null;
        setDrag(null);
      }
    };

    ownerWindow.addEventListener(EVENT.KEYDOWN, onKeyDown, true);
    return () => {
      ownerWindow.removeEventListener(EVENT.KEYDOWN, onKeyDown, true);
      const activeDrag = dragRef.current;
      if (activeDrag) {
        releasePointerCapture(activeDrag);
        app.flowchart.cancelDragPreview();
        dragRef.current = null;
      }
    };
  }, [app]);

  const selectedElements = app.scene.getSelectedElements(appState);
  const selectedElement =
    selectedElements.length === 1 ? selectedElements[0] : null;

  const canShowHandles =
    app.isInteractionEnabled() &&
    !appState.viewModeEnabled &&
    appState.activeTool.type === "selection" &&
    !appState.newElement &&
    !appState.selectionElement &&
    !appState.resizingElement &&
    !appState.selectedElementsAreBeingDragged &&
    !appState.editingTextElement &&
    !appState.contextMenu &&
    !appState.openDialog &&
    (!app.flowchart.isCreatingChart || !!dragRef.current) &&
    selectedElement &&
    isFlowchartNodeElement(selectedElement) &&
    (selectedElement.type === "rectangle" ||
      selectedElement.type === "diamond") &&
    !selectedElement.locked &&
    selectedElement.angle === 0;

  if (!canShowHandles || !selectedElement) {
    return null;
  }

  const element = selectedElement;
  const topLeft = sceneCoordsToViewportCoords(
    { sceneX: element.x, sceneY: element.y },
    appState,
  );
  const zoom = appState.zoom.value;
  const elementLeft = topLeft.x - appState.offsetLeft;
  const elementTop = topLeft.y - appState.offsetTop;
  const elementWidth = element.width * zoom;
  const elementHeight = element.height * zoom;
  const centerX = elementLeft + elementWidth / 2;
  const centerY = elementTop + elementHeight / 2;
  const positions: Record<LinkDirection, { left: number; top: number }> = {
    up: {
      left: centerX - HANDLE_SIZE / 2,
      top: elementTop - HANDLE_GAP - HANDLE_SIZE,
    },
    right: {
      left: elementLeft + elementWidth + HANDLE_GAP,
      top: centerY - HANDLE_SIZE / 2,
    },
    down: {
      left: centerX - HANDLE_SIZE / 2,
      top: elementTop + elementHeight + HANDLE_GAP,
    },
    left: {
      left: elementLeft - HANDLE_GAP - HANDLE_SIZE,
      top: centerY - HANDLE_SIZE / 2,
    },
  };

  const updatePreview = (event: React.PointerEvent<HTMLButtonElement>) => {
    const activeDrag = dragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    const scenePointer = viewportCoordsToSceneCoords(event, appState);
    const position = getNodePositionForPointer(
      element,
      activeDrag.direction,
      scenePointer,
    );
    app.flowchart.updateDragPreview(position.x, position.y);
  };

  const finishDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    canceled: boolean,
  ) => {
    const activeDrag = dragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    releasePointerCapture(activeDrag);

    if (canceled) {
      app.flowchart.cancelDragPreview();
    } else {
      app.flowchart.commitDragPreview();
    }
    dragRef.current = null;
    setDrag(null);
  };

  return (
    <div className="excalidraw-flowchart-handle-layer">
      {DIRECTIONS.map(({ direction, symbol, label }) => {
        const position = positions[direction];
        return (
          <button
            type="button"
            key={direction}
            className="excalidraw-flowchart-handle"
            data-direction={direction}
            data-testid={`flowchart-handle-${direction}`}
            aria-label={label}
            title={`${label} (drag)`}
            style={{
              left: `${position.left}px`,
              top: `${position.top}px`,
            }}
            data-dragging={drag?.direction === direction}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture?.(event.pointerId);

              const scenePointer = viewportCoordsToSceneCoords(event, appState);
              const nodePosition = getNodePositionForPointer(
                element,
                direction,
                scenePointer,
              );
              const nextDrag = {
                elementId: element.id,
                pointerId: event.pointerId,
                direction,
                target: event.currentTarget,
              };
              dragRef.current = nextDrag;
              setDrag(nextDrag);
              app.flowchart.startDragPreview(
                element,
                direction,
                nodePosition.x,
                nodePosition.y,
              );
            }}
            onPointerMove={updatePreview}
            onPointerUp={(event) => finishDrag(event, false)}
            onPointerCancel={(event) => finishDrag(event, true)}
            onKeyDown={(event) => {
              if (event.key === KEYS.ESCAPE && dragRef.current) {
                event.preventDefault();
                event.stopPropagation();
                cancelDrag();
              }
            }}
          >
            {symbol}
          </button>
        );
      })}
    </div>
  );
};

export default FlowchartHandles;
