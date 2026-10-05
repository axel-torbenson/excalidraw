import { ROUNDNESS } from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";

import { Scene } from "../Scene";
import { addNewNodeAtPosition, addNewNodes } from "../flowchart";
import { newElement, newStickyNoteElement } from "../newElement";
import { isFlowchartNodeElement, isStickyNoteElement } from "../typeChecks";

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

  it("creates a styled, bound node at a pointer-derived position", () => {
    const rectangle = newElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 180,
      height: 90,
      backgroundColor: "#aabbcc",
      strokeColor: "#123456",
      strokeWidth: 4,
      roughness: 2,
    });
    if (!isFlowchartNodeElement(rectangle)) {
      throw new Error("Expected a flowchart node");
    }
    const scene = new Scene([rectangle], { skipValidation: true });
    const { node, nodes } = addNewNodeAtPosition(
      rectangle,
      { currentItemEndArrowhead: "arrow" } as AppState,
      "right",
      scene,
      { x: 400, y: 20 },
    );
    const arrow = nodes.find((element) => element.type === "arrow")!;

    expect(node).toMatchObject({
      type: "rectangle",
      x: 400,
      y: 20,
      width: 180,
      height: 90,
      backgroundColor: "#aabbcc",
      strokeColor: "#123456",
      strokeWidth: 4,
      roughness: 2,
    });
    expect(arrow).toMatchObject({
      type: "arrow",
      startBinding: { elementId: rectangle.id },
      endBinding: { elementId: node.id },
    });
  });
});
