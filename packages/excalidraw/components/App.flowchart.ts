import { isArrowKey, KEYS } from "@excalidraw/common";

import {
  makeNextSelectedElementIds,
  CaptureUpdateAction,
  FlowChartCreator,
  FlowChartNavigator,
  getSelectedElements,
  isFlowchartNodeElement,
  Scene,
  type LinkDirection,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
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
    sourceId: string;
    direction: LinkDirection | null;
    scene: Scene;
  } | null = null;

  constructor(private app: App) {}

  get pendingNodes() {
    return this.creator.pendingNodes;
  }

  get isCreatingChart() {
    return this.creator.isCreatingChart;
  }

  /** ends any in-progress flowchart creation/navigation session */
  clear = () => {
    this.creator.clear();
    this.navigator.clear();
    this.drag?.scene.destroy();
    this.drag = null;
  };

  beginDrag = (source: NonDeletedExcalidrawElement) => {
    this.clear();
    const scene = new Scene();
    // Binding creation mutates its targets. Keep every preview mutation out of
    // the real scene (including the source's reciprocal boundElements).
    scene.replaceAllElements(
      this.app.scene.getElementsIncludingDeleted().map((element) => ({
        ...element,
        boundElements: element.boundElements?.slice() ?? null,
      })),
    );
    this.drag = { sourceId: source.id, direction: null, scene };
  };

  previewDrag = (direction: LinkDirection) => {
    const drag = this.drag;
    if (!drag || drag.direction === direction) {
      return;
    }
    const source = drag.scene.getNonDeletedElement(drag.sourceId);
    if (!source || !isFlowchartNodeElement(source)) {
      return;
    }
    this.creator.clear();
    this.creator.createNodes(source, this.app.state, direction, drag.scene);
    drag.direction = direction;
    this.app.triggerRender(true);
  };

  cancelDrag = () => {
    if (!this.drag) {
      return;
    }
    this.clear();
    this.app.triggerRender(true);
  };

  finishDrag = () => {
    if (!this.drag) {
      return;
    }
    const source = this.app.scene.getNonDeletedElement(this.drag.sourceId);
    const nodes = this.creator.pendingNodes ?? [];
    this.clear();
    if (!source || source.locked || !nodes.length) {
      this.app.triggerRender(true);
      return;
    }
    this.app.insertNewElements(nodes);
    this.app.scene.mutateElement(source, {
      boundElements: [
        ...(source.boundElements ?? []),
        ...nodes
          .filter((node) => node.type === "arrow")
          .map((node) => ({ id: node.id, type: "arrow" as const })),
      ],
    });
    this.selectAndReveal(nodes[0]);
    this.captureUpdate();
  };

  handleKeyEvent = (event: React.KeyboardEvent | KeyboardEvent): boolean => {
    if (this.drag) {
      if (event.type === "keydown" && event.key === KEYS.ESCAPE) {
        event.preventDefault();
        this.cancelDrag();
        return true;
      }
      // Releasing modifiers must not commit a pointer-owned preview.
      return false;
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
