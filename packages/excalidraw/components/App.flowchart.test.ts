import { Scene, newElement } from "@excalidraw/element";

import { AppFlowchart } from "./App.flowchart";

describe("AppFlowchart", () => {
  it("does not commit a pointer drag on keyup", () => {
    const ownerWindow = new EventTarget();
    const ownerDocument = new EventTarget();
    const node = newElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 180,
      height: 90,
    });
    const scene = new Scene([node], { skipValidation: true });
    const app = {
      state: { viewModeEnabled: false },
      ownerWindow,
      ownerDocument,
      scene,
      cursor: { set: () => {}, reset: () => {} },
    };
    const flowchart = new AppFlowchart(app as never);
    const pointerDown = Object.assign(new Event("pointerdown"), {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      preventDefault: () => {},
      stopPropagation: () => {},
    }) as PointerEvent;

    flowchart.beginPointerDrag(node as never, "right", pointerDown);
    const creator = (
      flowchart as unknown as {
        creator: {
          createNodeAtPosition: Function;
          pendingNodes: unknown;
          isCreatingChart: boolean;
        };
      }
    ).creator;
    creator.createNodeAtPosition(
      node,
      { currentItemEndArrowhead: "arrow" },
      "right",
      scene,
      { x: 400, y: 100 },
      false,
    );
    const pending = creator.pendingNodes;

    expect(
      flowchart.handleKeyEvent({
        type: "keyup",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      } as KeyboardEvent),
    ).toBe(false);
    expect(creator.pendingNodes).toBe(pending);
    flowchart.clear();
  });
});
