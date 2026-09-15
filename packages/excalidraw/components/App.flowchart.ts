import { isArrowKey, KEYS } from "@excalidraw/common";

import {
  makeNextSelectedElementIds,
  CaptureUpdateAction,
  FlowChartCreator,
  FlowChartNavigator,
  getSelectedElements,
  getFlowchartHandleAtPosition,
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
  private pointerSessionActive = false;
  private dragging: {
    node: NonDeleted<ExcalidrawFlowchartNodeElement> & {
      type: "rectangle" | "diamond";
    };
    direction: LinkDirection;
  } | null = null;

  constructor(private app: App) {}

  get pendingNodes() {
    return this.creator.pendingNodes;
  }

  get isCreatingChart() {
    return this.creator.isCreatingChart;
  }

  get isDragging() {
    return this.dragging !== null;
  }

  get isPointerSessionActive() {
    return this.pointerSessionActive;
  }

  /** ends any in-progress flowchart creation/navigation session */
  clear = () => {
    this.dragging = null;
    this.pointerSessionActive = false;
    this.creator.clear();
    this.navigator.clear();
  };

  private getSelectedFlowchartNode() {
    const selectedElements = getSelectedElements(
      this.app.scene.getNonDeletedElementsMap(),
      this.app.state,
    );
    const node = selectedElements.length === 1 ? selectedElements[0] : null;

    return node &&
      isFlowchartNodeElement(node) &&
      (node.type === "rectangle" || node.type === "diamond") &&
      !node.locked &&
      node.angle === 0
      ? (node as NonDeleted<ExcalidrawFlowchartNodeElement> & {
          type: "rectangle" | "diamond";
        })
      : null;
  }

  getHandleDirection(point: { x: number; y: number }): LinkDirection | null {
    if (
      this.dragging ||
      this.creator.isCreatingChart ||
      this.app.state.viewModeEnabled ||
      this.app.state.editingTextElement ||
      this.app.state.activeTool.type !== "selection"
    ) {
      return null;
    }

    const node = this.getSelectedFlowchartNode();
    return node
      ? getFlowchartHandleAtPosition(node, point, this.app.state.zoom.value)
      : null;
  }

  /**
   * Starts a pointer-driven flowchart creation session when the pointer is
   * over one of the directional handles. The pending pair is deliberately
   * kept in FlowChartCreator so it follows the same style, binding, preview,
   * and history path as keyboard-created nodes.
   */
  handlePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    point: { x: number; y: number },
  ): boolean => {
    if (
      event[KEYS.CTRL_OR_CMD] ||
      event.altKey ||
      event.shiftKey ||
      this.app.state.viewModeEnabled ||
      this.app.state.editingTextElement ||
      this.app.state.activeTool.type !== "selection"
    ) {
      return false;
    }

    const node = this.getSelectedFlowchartNode();
    const direction =
      node &&
      getFlowchartHandleAtPosition(node, point, this.app.state.zoom.value);

    if (!node || !direction) {
      return false;
    }

    this.dragging = { node, direction };
    this.pointerSessionActive = true;
    this.creator.createNodeAtPoint(
      node,
      this.app.state,
      direction,
      this.app.scene,
      point,
    );
    this.app.triggerRender(true);
    return true;
  };

  /**
   * Updates the pending node only. Since it is not in the scene, pointer
   * movement cannot create history entries.
   */
  handlePointerMove = (point: { x: number; y: number }): boolean => {
    if (!this.pointerSessionActive) {
      return false;
    }

    if (!this.dragging) {
      return true;
    }

    this.creator.createNodeAtPoint(
      this.dragging.node,
      this.app.state,
      this.dragging.direction,
      this.app.scene,
      point,
    );
    this.app.triggerRender(true);
    return true;
  };

  /**
   * Commits on a genuine pointerup and clears the pending preview on every
   * other termination path (pointercancel, lost pointer capture, or Escape).
   */
  handlePointerUp = (
    event: PointerEvent,
    point?: { x: number; y: number },
  ): boolean => {
    if (!this.pointerSessionActive) {
      return false;
    }

    if (this.dragging && event.type === "pointerup" && point) {
      this.creator.createNodeAtPoint(
        this.dragging.node,
        this.app.state,
        this.dragging.direction,
        this.app.scene,
        point,
      );
    }

    const nodes =
      event.type === "pointerup" ? this.creator.pendingNodes ?? [] : [];
    this.dragging = null;
    this.pointerSessionActive = false;
    this.creator.clear();

    if (nodes.length) {
      this.app.insertNewElements(nodes);
      const firstNode = nodes[0];
      if (firstNode) {
        this.selectAndReveal(firstNode);
      }
      this.captureUpdate();
    }

    this.app.triggerRender(true);
    return true;
  };

  handleKeyEvent = (event: React.KeyboardEvent | KeyboardEvent): boolean => {
    if (this.pointerSessionActive) {
      if (
        event.type === "keydown" &&
        event.key === KEYS.ESCAPE &&
        (this.dragging || this.creator.isCreatingChart)
      ) {
        this.dragging = null;
        this.creator.clear();
        this.app.triggerRender(true);
      }

      // A pointer flow owns the keyboard lifecycle until its pointer is
      // released. In particular, modifier keyup must not commit the creator,
      // and arrows must not run the keyboard navigation workflow.
      event.preventDefault();
      return true;
    }

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
        (creator.isCreatingChart || this.dragging)
      ) {
        this.dragging = null;
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
