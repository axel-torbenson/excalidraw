import {
  isArrowKey,
  KEYS,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import {
  addNewNodeAtPosition,
  getFlowchartHandlePosition,
  isPointInElement,
  makeNextSelectedElementIds,
  CaptureUpdateAction,
  FlowChartCreator,
  FlowChartNavigator,
  getSelectedElements,
  isFlowchartNodeElement,
  type LinkDirection,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFlowchartNodeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type React from "react";
import type App from "./App";
import type { PendingExcalidrawElements } from "../types";

type FlowchartOperation =
  | { type: "none" }
  | { type: "canceled" }
  | { type: "creating"; pending: PendingExcalidrawElements }
  | { type: "navigating"; nodeId: ExcalidrawElement["id"] | null }
  | { type: "committed"; nodes: PendingExcalidrawElements }
  | { type: "navigationEnded" };

/**
 * Captures the App state management for the flowchart functionality.
 */
export class AppFlowchart {
  private creator = new FlowChartCreator();
  private navigator = new FlowChartNavigator();
  private drag: {
    pointerId: number;
    source: NonDeleted<ExcalidrawFlowchartNodeElement>;
    direction: LinkDirection;
    startClient: { x: number; y: number };
    moved: boolean;
    dragging: boolean;
    preview: PendingExcalidrawElements | null;
  } | null = null;

  constructor(private app: App) {}

  get pendingNodes() {
    return this.drag?.preview || this.creator.pendingNodes;
  }

  get isCreatingChart() {
    return this.creator.isCreatingChart;
  }

  /** ends any in-progress flowchart creation/navigation session */
  clear = () => {
    this.cancelDrag();
    this.creator.clear();
    this.navigator.clear();
  };

  /**
   * Directional drag handles are only shown for a single selected rectangle
   * or diamond while the editor is idle and using the selection tool.
   */
  get handleElement(): NonDeleted<ExcalidrawFlowchartNodeElement> | null {
    const { state } = this.app;
    if (
      !this.app.isInteractionEnabled() ||
      state.viewModeEnabled ||
      state.activeTool.type !== "selection" ||
      state.newElement ||
      state.selectionElement ||
      state.isResizing ||
      state.isRotating ||
      state.isCropping ||
      state.selectedElementsAreBeingDragged ||
      state.cursorButton === "down" ||
      state.editingTextElement ||
      state.editingFrame ||
      state.selectedLinearElement ||
      this.drag
    ) {
      return null;
    }

    const selected = getSelectedElements(
      this.app.scene.getNonDeletedElementsMap(),
      state,
    );
    const element = selected[0];
    return selected.length === 1 &&
      (element?.type === "rectangle" || element?.type === "diamond")
      ? (element as NonDeleted<ExcalidrawFlowchartNodeElement>)
      : null;
  }

  /**
   * Consume pointer-downs on the four canvas-rendered handles. A plain click
   * creates the usual one-gap node; a short movement below the 6px drag
   * threshold cancels instead.
   */
  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (
      (event.button != null && event.button !== 0) ||
      this.drag ||
      this.creator.isCreatingChart
    ) {
      return false;
    }

    const source = this.handleElement;
    if (!source) {
      return false;
    }

    const origin = viewportCoordsToSceneCoords(event, this.app.state);
    const direction = AppFlowchart.getDirectionForHandle(
      source,
      origin,
      this.app.state.zoom.value,
    );
    if (!direction) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    this.drag = {
      pointerId: event.pointerId,
      source,
      direction,
      startClient: { x: event.clientX, y: event.clientY },
      moved: false,
      dragging: false,
      preview: null,
    };
    this.app.ownerWindow.addEventListener(
      "pointermove",
      this.handleDragMove,
      true,
    );
    this.app.ownerWindow.addEventListener("pointerup", this.handleDragUp, true);
    this.app.ownerWindow.addEventListener(
      "pointercancel",
      this.handleDragCancel,
      true,
    );
    this.app.ownerWindow.addEventListener(
      "keydown",
      this.handleDragKeyDown,
      true,
    );
    this.app.triggerRender(true);
    return true;
  };

  handleKeyEvent = (event: React.KeyboardEvent | KeyboardEvent): boolean => {
    const operation = this.resolveKeyboardEventToOperation(event);

    switch (operation.type) {
      case "none":
        return false;
      case "canceled":
        this.app.triggerRender(true);
        return true;
      case "creating":
        event.preventDefault();
        if (operation.pending.length) {
          this.app.revealIfHidden(operation.pending);
        }
        return true;
      case "navigating": {
        event.preventDefault();
        const node =
          operation.nodeId &&
          this.app.scene.getNonDeletedElementsMap().get(operation.nodeId);
        if (node) {
          this.selectAndReveal(node);
        }
        return true;
      }
      case "committed": {
        if (operation.nodes.length) {
          this.app.insertNewElements(operation.nodes);
        }

        const firstNode = operation.nodes[0];
        if (firstNode) {
          this.selectAndReveal(firstNode);
        }

        this.captureUpdate();
        return true;
      }
      case "navigationEnded":
        this.captureUpdate();
        return true;
    }
  };

  private resolveKeyboardEventToOperation(
    event: React.KeyboardEvent | KeyboardEvent,
  ): FlowchartOperation {
    const { creator, navigator, app } = this;

    if (event.type === "keydown") {
      if (event.key === KEYS.ESCAPE && creator.isCreatingChart) {
        creator.clear();
        return { type: "canceled" };
      }

      if (!isArrowKey(event.key)) {
        return { type: "none" };
      }

      if (event[KEYS.CTRL_OR_CMD] && !event.shiftKey) {
        const selectedElements = getSelectedElements(
          app.scene.getNonDeletedElementsMap(),
          app.state,
        );

        if (
          selectedElements.length === 1 &&
          isFlowchartNodeElement(selectedElements[0])
        ) {
          creator.createNodes(
            selectedElements[0],
            app.state,
            AppFlowchart.getLinkDirectionFromKey(event.key),
            app.scene,
          );
        }

        return { type: "creating", pending: creator.pendingNodes ?? [] };
      }

      if (event.altKey) {
        const elementsMap = app.scene.getNonDeletedElementsMap();
        const selectedElements = getSelectedElements(elementsMap, app.state);

        if (selectedElements.length === 1) {
          return {
            type: "navigating",
            nodeId: navigator.exploreByDirection(
              selectedElements[0],
              elementsMap,
              AppFlowchart.getLinkDirectionFromKey(event.key),
            ),
          };
        }
      }

      return { type: "none" };
    }

    // keyup: releasing a modifier finalizes the workflow it was driving;
    // both can finalize on the same event
    const navigationEnded = !event.altKey && navigator.isExploring;
    if (navigationEnded) {
      navigator.clear();
    }

    if (!event[KEYS.CTRL_OR_CMD] && creator.isCreatingChart) {
      const nodes = creator.pendingNodes ?? [];
      creator.clear();
      return { type: "committed", nodes };
    }

    return navigationEnded ? { type: "navigationEnded" } : { type: "none" };
  }

  private selectAndReveal(node: NonDeletedExcalidrawElement) {
    this.app.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds(
        { [node.id]: true },
        prevState,
      ),
    }));
    this.app.revealIfHidden([node]);
  }

  private captureUpdate() {
    this.app.syncActionResult({
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  private handleDragMove = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - drag.startClient.x,
      event.clientY - drag.startClient.y,
    );
    if (distance > 1) {
      drag.moved = true;
    }
    if (distance < 6) {
      return;
    }

    drag.dragging = true;
    drag.preview = this.makeDragPreview(drag, event);
    event.preventDefault();
    this.app.triggerRender(true);
  };

  private handleDragUp = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - drag.startClient.x,
      event.clientY - drag.startClient.y,
    );
    const releasedAt = viewportCoordsToSceneCoords(event, this.app.state);
    this.removeDragListeners();
    this.drag = null;

    if (drag.dragging && distance >= 6) {
      const isOverSource = isPointInElement(
        pointFrom<GlobalPoint>(releasedAt.x, releasedAt.y),
        drag.source,
        this.app.scene.getNonDeletedElementsMap(),
      );
      if (!isOverSource) {
        const nodes = this.makeDragPreview(drag, event);
        if (nodes?.length) {
          this.commitNodes(nodes);
        }
      }
    } else if (!drag.dragging && !drag.moved && distance <= 1) {
      this.creator.createNodes(
        drag.source,
        this.app.state,
        drag.direction,
        this.app.scene,
      );
      const nodes = this.creator.pendingNodes ?? [];
      this.creator.clear();
      this.commitNodes(nodes);
    }

    event.preventDefault();
    this.app.triggerRender(true);
  };

  private handleDragCancel = (event: PointerEvent) => {
    if (this.drag?.pointerId === event.pointerId) {
      this.cancelDrag();
    }
  };

  private handleDragKeyDown = (event: KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE && this.drag) {
      event.preventDefault();
      event.stopPropagation();
      this.cancelDrag();
    }
  };

  private makeDragPreview(
    drag: NonNullable<AppFlowchart["drag"]>,
    event: Pick<PointerEvent, "clientX" | "clientY">,
  ): PendingExcalidrawElements {
    const pointer = viewportCoordsToSceneCoords(event, this.app.state);
    const horizontal = drag.direction === "left" || drag.direction === "right";
    const position = horizontal
      ? {
          x: pointer.x - drag.source.width / 2,
          y: drag.source.y,
        }
      : {
          x: drag.source.x,
          y: pointer.y - drag.source.height / 2,
        };
    return addNewNodeAtPosition(
      drag.source,
      this.app.state,
      drag.direction,
      this.app.scene,
      position,
    ).nodes;
  }

  private commitNodes(nodes: PendingExcalidrawElements) {
    if (!nodes.length) {
      return;
    }
    this.app.insertNewElements(nodes);
    const node = nodes.find(
      (element) => element.type === "rectangle" || element.type === "diamond",
    );
    if (node) {
      this.selectAndReveal(node);
    }
    this.captureUpdate();
  }

  private removeDragListeners() {
    this.app.ownerWindow.removeEventListener(
      "pointermove",
      this.handleDragMove,
      true,
    );
    this.app.ownerWindow.removeEventListener(
      "pointerup",
      this.handleDragUp,
      true,
    );
    this.app.ownerWindow.removeEventListener(
      "pointercancel",
      this.handleDragCancel,
      true,
    );
    this.app.ownerWindow.removeEventListener(
      "keydown",
      this.handleDragKeyDown,
      true,
    );
  }

  private cancelDrag() {
    if (!this.drag) {
      return;
    }
    this.removeDragListeners();
    this.drag = null;
    this.app.triggerRender(true);
  }

  private static getDirectionForHandle(
    element: NonDeleted<ExcalidrawFlowchartNodeElement>,
    pointer: { x: number; y: number },
    zoom: number,
  ): LinkDirection | null {
    const directions: LinkDirection[] = ["up", "right", "down", "left"];
    const hitRadius = 10 / zoom;
    return (
      directions.find((direction) => {
        const handle = getFlowchartHandlePosition(element, direction, zoom);
        return (
          Math.hypot(pointer.x - handle.x, pointer.y - handle.y) <= hitRadius
        );
      }) ?? null
    );
  }

  private static getLinkDirectionFromKey(key: string): LinkDirection {
    switch (key) {
      case KEYS.ARROW_UP:
        return "up";
      case KEYS.ARROW_DOWN:
        return "down";
      case KEYS.ARROW_RIGHT:
        return "right";
      case KEYS.ARROW_LEFT:
        return "left";
      default:
        return "right";
    }
  }
}
