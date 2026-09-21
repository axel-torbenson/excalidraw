import {
  DRAGGING_THRESHOLD,
  isArrowKey,
  KEYS,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
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

export const shouldCommitKeyboardFlowchartOnKeyUp = (
  ctrlOrCmdPressed: boolean,
  isCreatingChart: boolean,
  keyboardCreationActive: boolean,
) => !ctrlOrCmdPressed && isCreatingChart && keyboardCreationActive;

/**
 * Captures the App state management for the flowchart functionality.
 */
export class AppFlowchart {
  private creator = new FlowChartCreator();
  private navigator = new FlowChartNavigator();
  private pointerDrag: {
    node: NonDeleted<ExcalidrawFlowchartNodeElement>;
    direction: LinkDirection;
    pointerId: number;
    origin: { x: number; y: number };
    isDragging: boolean;
  } | null = null;
  private keyboardCreationActive = false;

  constructor(private app: App) {}

  get pendingNodes() {
    return this.creator.pendingNodes;
  }

  get isCreatingChart() {
    return this.creator.isCreatingChart;
  }

  /** ends any in-progress flowchart creation/navigation session */
  clear = () => {
    this.clearPointerDrag();
    this.creator.clear();
    this.navigator.clear();
    this.keyboardCreationActive = false;
  };

  beginPointerDrag = (
    node: NonDeleted<ExcalidrawFlowchartNodeElement>,
    direction: LinkDirection,
    event: PointerEvent,
  ) => {
    if (this.pointerDrag || this.app.state.viewModeEnabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.keyboardCreationActive = false;
    this.pointerDrag = {
      node,
      direction,
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      isDragging: false,
    };

    this.app.ownerWindow.addEventListener(
      "pointermove",
      this.handlePointerDragMove,
    );
    this.app.ownerWindow.addEventListener(
      "pointerup",
      this.handlePointerDragUp,
    );
    this.app.ownerWindow.addEventListener(
      "pointercancel",
      this.handlePointerDragCancel,
    );
    this.app.ownerWindow.addEventListener(
      "keydown",
      this.handlePointerDragKeyDown,
    );
    this.app.ownerWindow.addEventListener("blur", this.handlePointerDragBlur);
    this.app.ownerDocument.addEventListener(
      "visibilitychange",
      this.handlePointerDragVisibilityChange,
    );
    this.app.cursor.set("grabbing");
  };

  private handlePointerDragMove = (event: PointerEvent) => {
    const drag = this.pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - drag.origin.x,
      event.clientY - drag.origin.y,
    );
    if (!drag.isDragging && distance < DRAGGING_THRESHOLD) {
      return;
    }

    drag.isDragging = true;
    const { x, y } = viewportCoordsToSceneCoords(
      { clientX: event.clientX, clientY: event.clientY },
      this.app.state,
    );
    this.creator.createNodeAtPosition(
      drag.node,
      this.app.state,
      drag.direction,
      this.app.scene,
      {
        x: x - drag.node.width / 2,
        y: y - drag.node.height / 2,
      },
      false,
    );
    this.app.revealIfHidden(this.creator.pendingNodes ?? []);
    this.app.triggerRender(true);
  };

  private handlePointerDragUp = (event: PointerEvent) => {
    const drag = this.pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    if (drag.isDragging) {
      const nodes = this.creator.pendingNodes ?? [];
      this.creator.clear();
      if (nodes.length) {
        const [, bindingArrow] = nodes;
        const boundElements = drag.node.boundElements ?? [];
        if (!boundElements.some(({ id }) => id === bindingArrow.id)) {
          this.app.scene.mutateElement(drag.node, {
            boundElements: boundElements.concat({
              id: bindingArrow.id,
              type: "arrow",
            }),
          });
        }
        this.app.insertNewElements(nodes);
        this.selectAndReveal(nodes[0]);
        this.captureUpdate();
      }
    } else {
      this.creator.clear();
    }
    this.clearPointerDragListeners();
    this.app.triggerRender(true);
  };

  private handlePointerDragCancel = (event: PointerEvent) => {
    const drag = this.pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    this.creator.clear();
    this.clearPointerDragListeners();
    this.app.triggerRender(true);
  };

  private handlePointerDragKeyDown = (event: KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE && this.pointerDrag) {
      event.preventDefault();
      this.creator.clear();
      this.clearPointerDragListeners();
      this.app.triggerRender(true);
    }
  };

  private handlePointerDragBlur = () => {
    this.cancelPointerDrag();
  };

  private handlePointerDragVisibilityChange = () => {
    if (this.app.ownerDocument.visibilityState === "hidden") {
      this.cancelPointerDrag();
    }
  };

  cancelPointerDrag = () => {
    if (!this.pointerDrag) {
      return;
    }
    this.creator.clear();
    this.clearPointerDragListeners();
    this.app.triggerRender(true);
  };

  private clearPointerDragListeners = () => {
    this.app.ownerWindow.removeEventListener(
      "pointermove",
      this.handlePointerDragMove,
    );
    this.app.ownerWindow.removeEventListener(
      "pointerup",
      this.handlePointerDragUp,
    );
    this.app.ownerWindow.removeEventListener(
      "pointercancel",
      this.handlePointerDragCancel,
    );
    this.app.ownerWindow.removeEventListener(
      "keydown",
      this.handlePointerDragKeyDown,
    );
    this.app.ownerWindow.removeEventListener(
      "blur",
      this.handlePointerDragBlur,
    );
    this.app.ownerDocument.removeEventListener(
      "visibilitychange",
      this.handlePointerDragVisibilityChange,
    );
    this.pointerDrag = null;
    this.app.cursor.reset();
  };

  private clearPointerDrag = () => {
    if (!this.pointerDrag) {
      return;
    }
    this.creator.clear();
    this.clearPointerDragListeners();
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
      if (
        event.key === KEYS.ESCAPE &&
        (creator.isCreatingChart || this.pointerDrag)
      ) {
        this.clearPointerDrag();
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
          this.keyboardCreationActive = creator.isCreatingChart;
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

    if (
      shouldCommitKeyboardFlowchartOnKeyUp(
        event[KEYS.CTRL_OR_CMD],
        creator.isCreatingChart,
        this.keyboardCreationActive,
      )
    ) {
      const nodes = creator.pendingNodes ?? [];
      creator.clear();
      this.keyboardCreationActive = false;
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
