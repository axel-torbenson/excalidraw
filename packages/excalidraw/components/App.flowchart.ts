import React from "react";

import { isArrowKey, KEYS } from "@excalidraw/common";

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
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type App from "./App";
import type { PendingExcalidrawElements } from "../types";

type FlowchartOperation =
  | { type: "none" }
  | { type: "canceled" }
  | { type: "creating"; pending: PendingExcalidrawElements }
  | { type: "navigating"; nodeId: ExcalidrawElement["id"] | null }
  | { type: "committed"; nodes: PendingExcalidrawElements }
  | { type: "navigationEnded" };

type DragDirection = LinkDirection;

type FlowchartDrag = {
  pointerId: number;
  sourceId: ExcalidrawElement["id"];
  direction: DragDirection;
  scenePoint: { x: number; y: number };
};

const HANDLE_SIZE = 18;
const HANDLE_OFFSET = 14;

/**
 * Captures the App state management for the flowchart functionality.
 */
export class AppFlowchart {
  private creator = new FlowChartCreator();
  private navigator = new FlowChartNavigator();
  private drag: FlowchartDrag | null = null;

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
    this.drag = null;
    this.app.triggerRender(true);
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

  /**
   * Renders directional affordances only for a single editable flowchart
   * node. The affordances live above the canvas, so the canvas's normal
   * pointer lifecycle stays untouched until a drag is committed.
   */
  renderDragHandles = () => {
    if (
      !this.app.isInteractionEnabled() ||
      this.app.state.viewModeEnabled ||
      this.app.state.activeTool.type !== "selection" ||
      this.app.state.editingTextElement
    ) {
      return null;
    }

    const selected = getSelectedElements(
      this.app.scene.getNonDeletedElementsMap(),
      this.app.state,
    );
    if (
      selected.length !== 1 ||
      selected[0].locked ||
      !isFlowchartNodeElement(selected[0]) ||
      (selected[0].type !== "rectangle" && selected[0].type !== "diamond")
    ) {
      return null;
    }

    const node = selected[0];
    const origin = this.app.sceneCoordsToViewportCoords({
      sceneX: node.x,
      sceneY: node.y,
    });
    const zoom = this.app.state.zoom.value;
    const width = node.width * zoom;
    const height = node.height * zoom;
    const center = {
      x: origin.x + width / 2,
      y: origin.y + height / 2,
    };

    const directions: DragDirection[] = ["up", "right", "down", "left"];
    const handlePoints: Record<DragDirection, { x: number; y: number }> = {
      up: { x: center.x, y: origin.y - HANDLE_OFFSET },
      right: { x: origin.x + width + HANDLE_OFFSET, y: center.y },
      down: { x: center.x, y: origin.y + height + HANDLE_OFFSET },
      left: { x: origin.x - HANDLE_OFFSET, y: center.y },
    };

    const preview = this.drag?.sourceId === node.id ? this.drag : null;
    const previewNode = preview
      ? {
          x: preview.scenePoint.x - node.width / 2,
          y: preview.scenePoint.y - node.height / 2,
        }
      : null;
    const previewOrigin = previewNode
      ? this.app.sceneCoordsToViewportCoords({
          sceneX: previewNode.x,
          sceneY: previewNode.y,
        })
      : null;
    const previewCenter = previewOrigin
      ? {
          x: previewOrigin.x + width / 2,
          y: previewOrigin.y + height / 2,
        }
      : null;

    const previewElement =
      preview && previewCenter && previewOrigin
        ? React.createElement(
            "svg",
            {
              "aria-hidden": true,
              style: {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                overflow: "visible",
                pointerEvents: "none",
              },
            },
            React.createElement("line", {
              x1: center.x,
              y1: center.y,
              x2: previewCenter.x,
              y2: previewCenter.y,
              stroke: "var(--color-primary)",
              strokeDasharray: "6 5",
              strokeWidth: 2,
              opacity: 0.7,
            }),
            React.createElement("rect", {
              x: previewOrigin.x,
              y: previewOrigin.y,
              width,
              height,
              rx: node.type === "diamond" ? 0 : 8,
              fill: "var(--color-primary)",
              fillOpacity: 0.12,
              stroke: "var(--color-primary)",
              strokeDasharray: "6 5",
              strokeWidth: 2,
              transform:
                node.type === "diamond"
                  ? `rotate(45 ${previewCenter.x} ${previewCenter.y})`
                  : undefined,
            }),
          )
        : null;

    const handleElements = directions.map((direction) => {
      const point = handlePoints[direction];
      return React.createElement(
        "button",
        {
          key: direction,
          type: "button",
          "aria-label": `Create flowchart node ${direction}`,
          title: "Drag to create a connected node",
          onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) =>
            this.handleDragPointerDown(event, node, direction),
          onPointerMove: (event: React.PointerEvent) =>
            this.handleDragPointerMove(event),
          onPointerUp: (event: React.PointerEvent) =>
            this.handleDragPointerUp(event),
          onPointerCancel: () => this.cancelDrag(),
          style: {
            position: "absolute",
            left: point.x - HANDLE_SIZE / 2,
            top: point.y - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            padding: 0,
            border: "1px solid var(--color-primary)",
            borderRadius: "50%",
            background: "var(--color-primary)",
            boxShadow: "0 1px 3px rgb(0 0 0 / 20%)",
            color: "var(--color-gray-0)",
            cursor: "crosshair",
            pointerEvents: "auto",
            touchAction: "none",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            lineHeight: 1,
          },
        },
        direction === "up"
          ? "↑"
          : direction === "right"
          ? "→"
          : direction === "down"
          ? "↓"
          : "←",
      );
    });

    return React.createElement(
      "div",
      {
        className: "excalidraw-flowchart-drag-overlay",
        style: {
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 3,
        },
      },
      previewElement,
      ...handleElements,
    );
  };

  private handleDragPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    node: NonDeletedExcalidrawElement,
    direction: DragDirection,
  ) => {
    if (event.button !== 0 || this.drag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const scenePoint = this.app.viewportCoordsToSceneCoords(event);
    this.drag = {
      pointerId: event.pointerId,
      sourceId: node.id,
      direction,
      scenePoint,
    };
    this.app.triggerRender(true);
  };

  private handleDragPointerMove = (event: React.PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.drag.scenePoint = this.app.viewportCoordsToSceneCoords(event);
    this.app.triggerRender(true);
  };

  private handleDragPointerUp = (event: React.PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const drag = this.drag;
    const scenePoint = this.app.viewportCoordsToSceneCoords(event);
    this.drag = null;

    const node = this.app.scene.getNonDeletedElementsMap().get(drag.sourceId);
    if (node && isFlowchartNodeElement(node) && !node.locked) {
      const { node: nextNode, bindingArrow } =
        this.app.createFlowchartNodeAtPosition(
          node,
          drag.direction,
          scenePoint.x - node.width / 2,
          scenePoint.y - node.height / 2,
        );
      this.app.insertNewElements([nextNode, bindingArrow]);
      this.app.setState({
        selectedElementIds: { [nextNode.id]: true },
      });
      this.app.syncActionResult({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
    this.app.triggerRender(true);
  };

  private cancelDrag = () => {
    if (this.drag) {
      this.drag = null;
      this.app.triggerRender(true);
    }
  };

  private resolveKeyboardEventToOperation(
    event: React.KeyboardEvent | KeyboardEvent,
  ): FlowchartOperation {
    const { creator, navigator, app } = this;

    if (event.type === "keydown") {
      if (event.key === KEYS.ESCAPE) {
        if (this.drag) {
          this.cancelDrag();
          return { type: "canceled" };
        }
        if (creator.isCreatingChart) {
          creator.clear();
          return { type: "canceled" };
        }
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
