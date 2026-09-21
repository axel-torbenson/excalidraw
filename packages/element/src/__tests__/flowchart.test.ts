import { ROUNDNESS } from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";

import { Scene } from "../Scene";
import { addNewNodes } from "../flowchart";
import { newElement, newStickyNoteElement } from "../newElement";
import { isFlowchartNodeElement, isStickyNoteElement } from "../typeChecks";

import type { ExcalidrawFlowchartNodeElement, NonDeleted } from "../types";

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

  it.each(["rectangle", "diamond"] as const)(
    "creates four connected same-style %s nodes",
    (type) => {
      const source = newElement({
        type,
        x: 400,
        y: 400,
        width: 180,
        height: 100,
        roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
        roughness: 0,
        backgroundColor: "#dbeafe",
        strokeColor: "#1e3a8a",
        strokeWidth: 3,
        fillStyle: "solid",
        strokeStyle: "dashed",
      }) as NonDeleted<ExcalidrawFlowchartNodeElement>;
      const appState = {
        currentItemEndArrowhead: "arrow",
      } as AppState;

      for (const direction of ["up", "right", "down", "left"] as const) {
        const scene = new Scene([source], { skipValidation: true });
        const {
          nodes: [nextNode, bindingArrow],
        } = addNewNodes(source, appState, direction, scene, 1);

        expect(nextNode).toMatchObject({
          type,
          width: source.width,
          height: source.height,
          roundness: source.roundness,
          roughness: source.roughness,
          backgroundColor: source.backgroundColor,
          strokeColor: source.strokeColor,
          strokeWidth: source.strokeWidth,
          fillStyle: source.fillStyle,
          strokeStyle: source.strokeStyle,
        });
        expect(bindingArrow).toMatchObject({
          type: "arrow",
          startBinding: { elementId: source.id },
          endBinding: { elementId: nextNode.id },
        });

        const expectedPosition = {
          up: { x: source.x, y: source.y - source.height - 100 },
          right: { x: source.x + source.width + 100, y: source.y },
          down: { x: source.x, y: source.y + source.height + 100 },
          left: { x: source.x - source.width - 100, y: source.y },
        }[direction];
        expect(nextNode).toMatchObject(expectedPosition);
      }
    },
  );
});
