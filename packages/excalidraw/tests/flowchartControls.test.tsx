import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction, getTransformHandles } from "@excalidraw/element";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type { Radians } from "@excalidraw/math";

import { Excalidraw } from "../index";

import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";
import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";

import type { AppState } from "../types";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw handleKeyboardGlobally />);
  const node = API.createElement({
    type: "rectangle",
    x: 300,
    y: 300,
    width: 180,
    height: 100,
    strokeColor: "#1971c2",
    backgroundColor: "#a5d8ff",
    strokeWidth: 2,
    fillStyle: "solid",
    opacity: 80,
  });
  API.updateScene({
    elements: [node],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  API.setSelectedElements([node]);
});

const control = (direction = "right") =>
  screen.getByTestId(`flowchart-add-${direction}`);

describe("directional flowchart controls", () => {
  it.each(["up", "right", "down", "left"])(
    "creates and binds one styled successor %s in one undo step",
    (direction) => {
      const source = h.elements[0];
      fireEvent.click(control(direction));
      expect(h.elements).toHaveLength(3);
      const node = h.elements.find(
        (element) => element.type === "rectangle" && element.id !== source.id,
      )!;
      const arrow = h.elements.find((element) => element.type === "arrow")!;
      expect(arrow.type === "arrow" && arrow.startBinding?.elementId).toBe(
        source.id,
      );
      expect(arrow.type === "arrow" && arrow.endBinding?.elementId).toBe(
        node.id,
      );
      for (const key of [
        "type",
        "width",
        "height",
        "strokeColor",
        "backgroundColor",
        "strokeWidth",
        "fillStyle",
        "opacity",
      ] as const) {
        expect(node[key]).toEqual(source[key]);
      }
      expect(h.state.selectedElementIds).toEqual({ [node.id]: true });
      if (direction === "up") {
        expect(node.y).toBeLessThan(source.y);
      } else if (direction === "down") {
        expect(node.y).toBeGreaterThan(source.y);
      } else if (direction === "left") {
        expect(node.x).toBeLessThan(source.x);
      } else {
        expect(node.x).toBeGreaterThan(source.x);
      }
      Keyboard.undo();
      expect(h.elements.filter((element) => !element.isDeleted)).toEqual([
        expect.objectContaining({ id: source.id }),
      ]);
      Keyboard.redo();
      expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(
        3,
      );
    },
  );

  it("previews without mutating the source or scene and clears on leave", () => {
    const source = structuredClone(h.elements[0]);
    fireEvent.pointerEnter(control());
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    expect(h.elements).toHaveLength(1);
    expect(h.elements[0]).toEqual(source);
    fireEvent.pointerLeave(control());
    expect(h.app.flowchart.pendingNodes).toBeNull();
    expect(h.elements[0]).toEqual(source);
  });

  it("clears a preview when selection or visibility changes", () => {
    fireEvent.pointerEnter(control());
    API.clearSelection();
    expect(h.app.flowchart.pendingNodes).toBeNull();
    expect(screen.queryByTestId("flowchart-add-right")).toBeNull();
  });

  it("clones diamonds and allows Enter to edit the new label", () => {
    const diamond = API.createElement({
      type: "diamond",
      width: 150,
      height: 90,
    });
    API.setElements([diamond]);
    API.setSelectedElements([diamond]);
    fireEvent.click(control());
    expect(
      h.elements.filter((element) => element.type === "diamond"),
    ).toHaveLength(2);
    Keyboard.keyPress(KEYS.ENTER);
    expect(h.state.editingTextElement).not.toBeNull();
    expect(screen.queryByTestId("flowchart-add-right")).toBeNull();
  });

  it.each([
    { viewModeEnabled: true },
    { selectedElementsAreBeingDragged: true },
    { isResizing: true },
    { isRotating: true },
    { cursorButton: "down" },
  ] as Partial<AppState>[])("hides during incompatible state %j", (state) => {
    API.setAppState((previous: AppState) => ({ ...previous, ...state }));
    expect(screen.queryByTestId("flowchart-add-right")).toBeNull();
  });

  it("hides for locked, unsupported, and multiple selected elements", () => {
    for (const elements of [
      [API.createElement({ type: "rectangle", locked: true })],
      [API.createElement({ type: "ellipse" })],
      [
        API.createElement({ type: "rectangle" }),
        API.createElement({ type: "diamond" }),
      ],
    ]) {
      API.setElements(elements);
      API.setSelectedElements(elements);
      expect(screen.queryByTestId("flowchart-add-right")).toBeNull();
    }
  });

  it("intercepts pointer-down without beginning a selection or drag", () => {
    const button = control();
    const event = new Event("pointerdown", { bubbles: true, cancelable: true });
    act(() => button.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(h.state.cursorButton).toBe("up");
    expect(h.state.selectionElement).toBeNull();
    expect(h.state.selectedElementsAreBeingDragged).toBe(false);
  });

  it("does not interfere with ordinary shape dragging", () => {
    const source = h.elements[0];
    mouse.downAt(source.x + 50, source.y + 50);
    mouse.moveTo(source.x + 100, source.y + 100);
    expect(screen.queryByTestId("flowchart-add-right")).toBeNull();
    mouse.up();
    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].x).toBeGreaterThan(300);
    expect(control()).toBeTruthy();
  });

  it("keeps controls screen-sized and clear of transform handles when zoomed", () => {
    const before = parseFloat(control().style.left);
    API.setAppState({ zoom: { value: 0.5 as AppState["zoom"]["value"] } });
    expect(parseFloat(control().style.left)).toBeLessThan(before);
    // Source's right edge is now 240px; control center remains 38px outside.
    expect(parseFloat(control().style.left)).toBe(278);
    expect(control().title).toMatch(/Ctrl|Cmd|Command/);
  });

  it("keeps all controls outside rotated mouse and touch transform handles", () => {
    for (const pointer of ["mouse", "touch"] as const) {
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
        const node = API.createElement({
          type: "rectangle",
          x: 300,
          y: 300,
          width: 180,
          height: 100,
          angle: angle as Radians,
        });
        API.setElements([node]);
        API.setSelectedElements([node]);
        API.setAppState({ lastPointerDownWith: pointer });
        const handles = getTransformHandles(
          node,
          h.state.zoom,
          h.app.scene.getNonDeletedElementsMap(),
          pointer,
        );
        for (const direction of ["up", "right", "down", "left"]) {
          const button = control(direction);
          const x = parseFloat(button.style.left);
          const y = parseFloat(button.style.top);
          for (const handle of Object.values(handles)) {
            if (!handle) {
              continue;
            }
            const corner = sceneCoordsToViewportCoords(
              { sceneX: handle[0], sceneY: handle[1] },
              h.state,
            );
            const left = corner.x - h.state.offsetLeft;
            const top = corner.y - h.state.offsetTop;
            const right = left + handle[2] * h.state.zoom.value;
            const bottom = top + handle[3] * h.state.zoom.value;
            expect(
              x + 14 < left ||
                x - 14 > right ||
                y + 14 < top ||
                y - 14 > bottom,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("previews on keyboard focus without triggering canvas Enter-to-edit", () => {
    const button = control();
    fireEvent.focus(button);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(h.state.editingTextElement).toBeNull();
    fireEvent.click(button);
    expect(h.elements).toHaveLength(3);
  });
});
