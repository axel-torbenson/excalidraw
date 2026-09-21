import { vi } from "vitest";

import { Scene } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { AppFlowchart } from "../components/App.flowchart";
import { API } from "../tests/helpers/api";

import type { AppState } from "../types";

const createFlowchartApp = (type: "rectangle" | "diamond", locked = false) => {
  const node = API.createElement({
    type,
    x: 100,
    y: 100,
    width: 160,
    height: 80,
    strokeColor: "#123456",
    backgroundColor: "#abcdef",
    fillStyle: "solid",
    strokeWidth: 4,
    locked,
  });
  const scene = new Scene([node], { skipValidation: true });
  const state = {
    selectedElementIds: { [node.id]: true },
    currentItemEndArrowhead: "arrow",
  } as AppState;
  const app = {
    scene,
    state,
    insertNewElements: vi.fn((elements) =>
      scene.insertElementsAtIndex(elements, null),
    ),
    setState: vi.fn((update) => {
      Object.assign(
        state,
        typeof update === "function" ? update(state) : update,
      );
    }),
    revealIfHidden: vi.fn(),
    syncActionResult: vi.fn(),
  };

  return { app, node };
};

describe("flowchart side plus creation", () => {
  it.each(["rectangle", "diamond"] as const)(
    "creates a bound, style-inheriting node for every direction from a %s",
    (type) => {
      for (const direction of ["up", "right", "down", "left"] as const) {
        const { app, node } = createFlowchartApp(type);
        const flowchart = new AppFlowchart(app as any);

        expect(flowchart.createNode(direction)).toBe(true);

        const inserted = app.insertNewElements.mock
          .calls[0][0] as NonDeletedExcalidrawElement[];
        const nextNode = inserted.find((element) => element.type === type);
        const arrow = inserted.find((element) => element.type === "arrow");

        if (!nextNode || !arrow) {
          throw new Error("Flowchart creation did not insert a node and arrow");
        }

        expect(nextNode).toMatchObject({
          strokeColor: node.strokeColor,
          backgroundColor: node.backgroundColor,
          fillStyle: node.fillStyle,
          strokeWidth: node.strokeWidth,
        });
        expect(arrow).toMatchObject({
          startBinding: { elementId: node.id },
          endBinding: { elementId: nextNode.id },
        });
        expect(app.syncActionResult).toHaveBeenCalledTimes(1);
      }
    },
  );

  it("does not create controls' action for locked or multi-selected nodes", () => {
    const { app } = createFlowchartApp("rectangle", true);
    const flowchart = new AppFlowchart(app as any);

    expect(flowchart.createNode("right")).toBe(false);
    expect(app.insertNewElements).not.toHaveBeenCalled();

    app.state.selectedElementIds = {};
    expect(flowchart.createNode("right")).toBe(false);
    expect(app.insertNewElements).not.toHaveBeenCalled();
  });
});
