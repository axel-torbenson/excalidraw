import { ROUNDNESS } from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";

import { Scene } from "../Scene";
import { addNewNodes, FlowChartCreator } from "../flowchart";
import { newElement, newStickyNoteElement } from "../newElement";
import { isFlowchartNodeElement, isStickyNoteElement } from "../typeChecks";

import type {
  ExcalidrawDiamondElement,
  ExcalidrawRectangleElement,
  NonDeleted,
} from "../types";

describe("flowchart", () => {
  it("creates connected sticky notes", () => {
    const sticky = newStickyNoteElement({
      type: "stickynote",
      x: 100,
      y: 100,
      width: 240,
      height: 260,
      baseHeight: 220,
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      roughness: 2,
      backgroundColor: "#ffec99",
      strokeColor: "#1e1e1e",
      strokeWidth: 2,
    });
    const scene = new Scene([sticky], { skipValidation: true });
    const {
      nodes: [nextNode, bindingArrow],
    } = addNewNodes(
      sticky,
      {
        currentItemEndArrowhead: "arrow",
      } as AppState,
      "right",
      scene,
      1,
    );

    expect(isFlowchartNodeElement(sticky)).toBe(true);
    expect(isFlowchartNodeElement(nextNode)).toBe(true);
    expect(isStickyNoteElement(nextNode)).toBe(true);
    expect(nextNode).toMatchObject({
      type: "stickynote",
      x: sticky.x + sticky.width + 100,
      y: sticky.y,
      width: sticky.width,
      height: sticky.height,
      baseHeight: sticky.baseHeight,
      roundness: sticky.roundness,
      roughness: sticky.roughness,
      backgroundColor: sticky.backgroundColor,
      strokeColor: sticky.strokeColor,
      strokeWidth: sticky.strokeWidth,
    });
    expect(bindingArrow).toMatchObject({
      type: "arrow",
      startBinding: { elementId: sticky.id },
      endBinding: { elementId: nextNode.id },
    });
  });
});

it("previews a positioned same-style node in every direction", () => {
  const start = newElement({
    type: "diamond",
    x: 100,
    y: 100,
    width: 180,
    height: 90,
    backgroundColor: "#dbeafe",
    strokeColor: "#1e3a8a",
    strokeWidth: 3,
  }) as NonDeleted<ExcalidrawDiamondElement>;
  const scene = new Scene([start], { skipValidation: true });
  const creator = new FlowChartCreator();

  for (const direction of ["up", "right", "down", "left"] as const) {
    creator.createNodeAtPosition(
      start,
      { currentItemEndArrowhead: "arrow" } as AppState,
      direction,
      scene,
      { x: 420, y: 260 },
    );

    const [node, arrow] = creator.pendingNodes ?? [];
    expect(node).toMatchObject({
      type: "diamond",
      x: 420,
      y: 260,
      width: start.width,
      height: start.height,
      backgroundColor: start.backgroundColor,
      strokeColor: start.strokeColor,
      strokeWidth: start.strokeWidth,
    });
    expect(arrow).toMatchObject({
      type: "arrow",
      startBinding: { elementId: start.id },
      endBinding: { elementId: node.id },
    });
  }
});

it("does not mutate the source binding while previewing", () => {
  const start = newElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 180,
    height: 90,
    boundElements: [{ id: "existing-arrow", type: "arrow" }],
  }) as NonDeleted<ExcalidrawRectangleElement>;
  const scene = new Scene([start], { skipValidation: true });
  const creator = new FlowChartCreator();
  const initialSource = { ...start };

  creator.createNodeAtPosition(
    start,
    { currentItemEndArrowhead: "arrow" } as AppState,
    "left",
    scene,
    { x: 420, y: 260 },
    false,
  );
  creator.createNodeAtPosition(
    start,
    { currentItemEndArrowhead: "arrow" } as AppState,
    "down",
    scene,
    { x: 420, y: 420 },
    false,
  );
  expect(start).toEqual(initialSource);
});
