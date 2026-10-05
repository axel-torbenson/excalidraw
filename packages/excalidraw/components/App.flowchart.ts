import {
  getGridPoint,
  isArrowKey,
  KEYS,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import {
  addNewNodeAtPosition,
  addNewNodes,
  CaptureUpdateAction,
  createFlowchartArrow,
  FlowChartCreator,
  FlowChartNavigator,
  getHoveredElementForBinding,
  getSelectedElements,
  isFlowchartNodeElement,
  makeNextSelectedElementIds,
  Scene,
  type LinkDirection,
} from "@excalidraw/element";

import type { GlobalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type React from "react";
import type App from "./App";
import type { PendingExcalidrawElements } from "../types";

type DragCreation = {
  sourceId: ExcalidrawElement["id"];
  direction: LinkDirection;
  pointerId: number;
  originX: number;
  originY: number;
  didMove: boolean;
  pendingNodes: PendingExcalidrawElements | null;
};

const DRAG_THRESHOLD = 6;
const ORIGIN_CANCEL_THRESHOLD = 12;

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
  private dragCreation: DragCreation | null = null;

  constructor(private app: App) {}

  get pendingNodes() {
    return this.dragCreation
      ? this.dragCreation.pendingNodes
      : this.creator.pendingNodes;
  }

  get isCreatingChart() {
    return this.creator.isCreatingChart;
  }

  get isDraggingCreation() {
    return this.dragCreation !== null;
  }

  /** ends any in-progress flowchart creation/navigation session */
  clear = () => {
    this.creator.clear();
    this.navigator.clear();
    this.dragCreation = null;
  };

  startDragCreation = (
    source: NonDeletedExcalidrawElement,
    direction: LinkDirection,
    event: React.PointerEvent,
  ) => {
    if (!isFlowchartNodeElement(source)) {
      return;
    }

    this.dragCreation = {
      sourceId: source.id,
      direction,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      didMove: false,
      pendingNodes: null,
    };
  };

  updateDragCreation = (event: React.PointerEvent) => {
    const gesture = this.dragCreation;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - gesture.originX,
      event.clientY - gesture.originY,
    );
    if (distance <= DRAG_THRESHOLD) {
      return;
    }

    const source = this.app.scene
      .getNonDeletedElementsMap()
      .get(gesture.sourceId);
    if (!source || !isFlowchartNodeElement(source)) {
      this.cancelDragCreation();
      return;
    }

    const { x: pointerX, y: pointerY } = viewportCoordsToSceneCoords(
      event,
      this.app.state,
    );
    const [x, y] = getGridPoint(
      pointerX - source.width / 2,
      pointerY - source.height / 2,
      this.app.getEffectiveGridSize(),
    );
    const previewScene = this.createPreviewScene();
    const previewSource = previewScene
      .getNonDeletedElementsMap()
      .get(source.id);

    if (!previewSource || !isFlowchartNodeElement(previewSource)) {
      this.cancelDragCreation();
      return;
    }

    gesture.didMove = true;
    gesture.pendingNodes = addNewNodeAtPosition(
      previewSource,
      this.app.state,
      gesture.direction,
      previewScene,
      x,
      y,
    ).nodes;
    this.app.triggerRender(true);
  };

  finishDragCreation = (event: React.PointerEvent) => {
    const gesture = this.dragCreation;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return false;
    }
    this.dragCreation = null;

    const distanceFromOrigin = Math.hypot(
      event.clientX - gesture.originX,
      event.clientY - gesture.originY,
    );
    if (gesture.didMove && distanceFromOrigin <= ORIGIN_CANCEL_THRESHOLD) {
      this.app.triggerRender(true);
      return true;
    }

    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const source = elementsMap.get(gesture.sourceId);
    if (!source || !isFlowchartNodeElement(source)) {
      this.app.triggerRender(true);
      return true;
    }

    let nodes: PendingExcalidrawElements;
    let selectedElement: NonDeletedExcalidrawElement;

    if (!gesture.didMove) {
      nodes = addNewNodes(
        source,
        this.app.state,
        gesture.direction,
        this.app.scene,
        1,
      ).nodes;
      selectedElement = nodes[0]!;
    } else {
      const { x: pointerX, y: pointerY } = viewportCoordsToSceneCoords(
        event,
        this.app.state,
      );
      const target = getHoveredElementForBinding(
        pointFrom<GlobalPoint>(pointerX, pointerY),
        this.app.scene.getNonDeletedElements(),
        elementsMap,
      );

      if (
        target &&
        target.id !== source.id &&
        !target.locked &&
        isFlowchartNodeElement(target)
      ) {
        nodes = [
          createFlowchartArrow(
            source,
            target,
            this.app.state,
            gesture.direction,
            this.app.scene,
          ),
        ];
        selectedElement = target;
      } else {
        const [x, y] = getGridPoint(
          pointerX - source.width / 2,
          pointerY - source.height / 2,
          this.app.getEffectiveGridSize(),
        );
        nodes = addNewNodeAtPosition(
          source,
          this.app.state,
          gesture.direction,
          this.app.scene,
          x,
          y,
        ).nodes;
        selectedElement = nodes[0]!;
      }
    }

    this.app.insertNewElements(nodes);
    this.selectAndReveal(selectedElement);
    this.captureUpdate();
    this.app.focusContainer();
    this.app.triggerRender(true);
    return true;
  };

  cancelDragCreation = () => {
    if (this.dragCreation) {
      this.dragCreation = null;
      this.app.triggerRender(true);
    }
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
      if (event.key === KEYS.ESCAPE && this.dragCreation) {
        this.dragCreation = null;
        return { type: "canceled" };
      }

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

  private createPreviewScene() {
    return new Scene(
      this.app.scene.getElementsIncludingDeleted().map((element) => ({
        ...element,
        boundElements:
          element.boundElements?.map((binding) => ({
            ...binding,
          })) ?? null,
      })),
      { skipValidation: true },
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
