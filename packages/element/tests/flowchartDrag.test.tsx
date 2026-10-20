import { act, fireEvent, screen } from "@testing-library/react";

import { KEYS, reseed, sceneCoordsToViewportCoords } from "@excalidraw/common";
import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";
import {
  canShowFlowchartDragHandles,
  getFlowchartDragDirection,
} from "@excalidraw/excalidraw/components/FlowchartDragHandles";

unmountComponent();
const { h } = window;

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  await render(<Excalidraw handleKeyboardGlobally />);
});

const selectNode = (type: "rectangle" | "diamond" = "rectangle") => {
  const source = API.createElement({
    type,
    x: 200,
    y: 200,
    width: 160,
    height: 100,
    strokeColor: "#e03131",
    backgroundColor: "#ffc9c9",
    strokeWidth: 2,
    fillStyle: "solid",
  });
  API.setElements([source]);
  API.setSelectedElements([source]);
  return source;
};

describe("drag flowchart creation", () => {
  it.each(["rectangle", "diamond"] as const)(
    "previews %s without touching the source, then commits style and reciprocal bindings",
    (type) => {
      const source = selectNode(type);
      const before = JSON.stringify(h.elements);
      act(() => {
        h.app.flowchart.beginDrag(source);
        h.app.flowchart.previewDrag("right");
      });
      expect(JSON.stringify(h.elements)).toBe(before);
      expect(h.app.flowchart.pendingNodes).toHaveLength(2);
      const [preview] = h.app.flowchart.pendingNodes!;
      expect(preview).toMatchObject({
        type,
        width: 160,
        height: 100,
        strokeColor: "#e03131",
        backgroundColor: "#ffc9c9",
        strokeWidth: 2,
        fillStyle: "solid",
      });
      act(() => h.app.flowchart.finishDrag());
      expect(h.elements).toHaveLength(3);
      const arrow = h.elements.find((element) => element.type === "arrow")!;
      expect(arrow).toMatchObject({
        elbowed: true,
        startBinding: { elementId: source.id },
        endBinding: { elementId: preview.id },
      });
      expect(source.boundElements).toEqual([{ id: arrow.id, type: "arrow" }]);
      expect(
        h.elements.find((element) => element.id === preview.id)?.boundElements,
      ).toEqual([{ id: arrow.id, type: "arrow" }]);
      expect(API.getSelectedElements().map((node) => node.id)).toEqual([
        preview.id,
      ]);
    },
  );

  it("changing direction keeps one pending successor; cancellation leaves no mutations or undo entry", () => {
    const source = selectNode();
    const before = JSON.stringify(h.elements);
    const undoLength = API.getUndoStack().length;
    act(() => {
      h.app.flowchart.beginDrag(source);
      h.app.flowchart.previewDrag("right");
      h.app.flowchart.previewDrag("right");
      h.app.flowchart.previewDrag("down");
    });
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    Keyboard.keyPress(KEYS.ESCAPE);
    act(() => {
      // Late pointermove/up after Escape must not recreate anything.
      h.app.flowchart.previewDrag("left");
      h.app.flowchart.finishDrag();
    });
    expect(h.app.flowchart.pendingNodes).toBeNull();
    expect(JSON.stringify(h.elements)).toBe(before);
    expect(API.getUndoStack()).toHaveLength(undoLength);
  });

  it("does not commit a pointer preview on modifier release", () => {
    const source = selectNode();
    act(() => {
      h.app.flowchart.beginDrag(source);
      h.app.flowchart.previewDrag("right");
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    expect(h.elements).toHaveLength(1);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    act(() => h.app.flowchart.cancelDrag());
    expect(h.elements).toHaveLength(1);
  });

  it("adds a node and its arrow in one undo step and restores both on redo", () => {
    const source = UI.createElement("rectangle", {
      x: 200,
      y: 200,
      width: 160,
      height: 100,
    });
    act(() => {
      h.app.flowchart.beginDrag(h.app.scene.getNonDeletedElement(source.id)!);
      h.app.flowchart.previewDrag("down");
      h.app.flowchart.finishDrag();
    });
    expect(h.elements).toHaveLength(3);
    Keyboard.undo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
    expect(h.elements[0].boundElements ?? []).toHaveLength(0);
    Keyboard.redo();
    expect(h.elements).toHaveLength(3);
  });

  it("a click without a drag creates nothing", () => {
    const source = selectNode();
    act(() => {
      h.app.flowchart.beginDrag(source);
      h.app.flowchart.finishDrag();
    });
    expect(h.elements).toEqual([source]);
  });

  it("supports labeling the selected successor and undoing back to its source", async () => {
    const source = UI.createElement("rectangle", {
      x: 200,
      y: 200,
      width: 160,
      height: 100,
    });
    act(() => {
      h.app.flowchart.beginDrag(h.app.scene.getNonDeletedElement(source.id)!);
      h.app.flowchart.previewDrag("right");
      h.app.flowchart.finishDrag();
    });
    const successor = h.app.scene
      .getNonDeletedElements()
      .find(
        (element) => element.type === "rectangle" && element.id !== source.id,
      )!;
    if (successor.type !== "rectangle") {
      throw new Error("Expected a rectangle successor");
    }
    await UI.editText(successor, "Decision");
    expect(
      h.app.scene
        .getNonDeletedElements()
        .find((element) => element.type === "text"),
    ).toMatchObject({ text: "Decision", containerId: successor.id });
    // Text editing and binding use their own existing history entries.
    // The creation entry still removes both the node and its arrow together.
    for (let attempt = 0; attempt < 5; attempt++) {
      if (h.app.scene.getNonDeletedElements().length === 1) {
        break;
      }
      Keyboard.undo();
      const live = h.app.scene.getNonDeletedElements();
      const hasSuccessor = live.some((element) => element.id === successor.id);
      const hasArrow = live.some((element) => element.type === "arrow");
      expect(hasSuccessor).toBe(hasArrow);
    }
    expect(
      h.app.scene.getNonDeletedElements().map((element) => element.id),
    ).toEqual([source.id]);
  });

  it("handles pointer preview, pointercancel, and pointerup with zoom and pan", () => {
    const source = selectNode();
    act(() =>
      h.setState({
        zoom: { value: 2 as typeof h.state.zoom.value },
        scrollX: 40,
        scrollY: -20,
      }),
    );
    const button = screen.getByRole("button", {
      name: "Drag to connect right",
    });
    button.setPointerCapture = vi.fn();
    const origin = sceneCoordsToViewportCoords(
      { sceneX: source.x + source.width, sceneY: source.y + source.height / 2 },
      h.state,
    );
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX,
        clientY,
      });
      fireEvent(button, event);
    };
    pointer("pointerdown", origin.x, origin.y);
    pointer("pointermove", origin.x + 200, origin.y);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    expect(h.elements).toHaveLength(1);
    pointer("pointercancel", origin.x + 200, origin.y);
    expect(h.app.flowchart.pendingNodes).toBeNull();
    expect(source.boundElements ?? []).toHaveLength(0);
    pointer("pointerdown", origin.x, origin.y);
    pointer("pointermove", origin.x + 200, origin.y);
    pointer("pointerup", origin.x + 200, origin.y);
    expect(h.elements).toHaveLength(3);
    expect(h.elements[1].x).toBe(source.x + source.width + 100);
  });

  it("shows controls only for one editable ungrouped axis-aligned rectangle or diamond", () => {
    const source = selectNode();
    expect(
      screen.getAllByRole("button", { name: /Drag to connect/ }),
    ).toHaveLength(4);
    expect(canShowFlowchartDragHandles(h.app, [source])).toBeTruthy();
    expect(canShowFlowchartDragHandles(h.app, [])).toBeFalsy();
    expect(canShowFlowchartDragHandles(h.app, [source, source])).toBeFalsy();
    expect(
      canShowFlowchartDragHandles(h.app, [{ ...source, locked: true }]),
    ).toBeFalsy();
    expect(
      canShowFlowchartDragHandles(h.app, [{ ...source, groupIds: ["group"] }]),
    ).toBeFalsy();
    API.setSelectedElements([]);
    expect(
      screen.queryByRole("button", { name: /Drag to connect/ }),
    ).toBeNull();
    API.setSelectedElements([source]);
    act(() => h.setState({ viewModeEnabled: true }));
    expect(
      screen.queryByRole("button", { name: /Drag to connect/ }),
    ).toBeNull();
  });

  it("places handle centers in viewport coordinates after zoom and pan", () => {
    const source = selectNode();
    act(() =>
      h.setState({
        zoom: { value: 2 as typeof h.state.zoom.value },
        scrollX: -50,
        scrollY: 80,
        offsetLeft: 25,
        offsetTop: 40,
      }),
    );
    const right = screen.getByRole("button", { name: "Drag to connect right" });
    const expected = sceneCoordsToViewportCoords(
      { sceneX: source.x + source.width, sceneY: source.y + source.height / 2 },
      h.state,
    );
    expect(right.style.left).toBe(`${expected.x - h.state.offsetLeft + 26}px`);
    expect(right.style.top).toBe(`${expected.y - h.state.offsetTop}px`);
  });

  it.each([
    [200, 20, "right"],
    [-200, 20, "left"],
    [20, 200, "down"],
    [20, -200, "up"],
  ] as const)(
    "resolves direction from scene delta (%s, %s)",
    (dx, dy, direction) => {
      expect(getFlowchartDragDirection(dx, dy)).toBe(direction);
    },
  );

  it("keeps the existing keyboard flowchart workflow working", () => {
    selectNode();
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    expect(h.elements).toHaveLength(3);
    UI.clickTool("ellipse");
    expect(
      screen.queryByRole("button", { name: /Drag to connect/ }),
    ).toBeNull();
  });
});
