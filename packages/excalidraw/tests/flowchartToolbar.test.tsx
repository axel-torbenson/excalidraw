import { fireEvent, screen } from "@testing-library/react";

import { CaptureUpdateAction, type LinkDirection } from "@excalidraw/element";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();
const { h } = window;
const labels = {
  up: "Add step above",
  right: "Add step to the right",
  down: "Add step below",
  left: "Add step to the left",
};

beforeEach(async () => {
  await render(<Excalidraw handleKeyboardGlobally />);
  API.setAppState({ width: 1000, height: 1000 });
});

const seed = (type: "rectangle" | "diamond" = "rectangle") => {
  const source = API.createElement({
    type,
    x: 400,
    y: 400,
    width: 120,
    height: 80,
    strokeColor: "#e03131",
    backgroundColor: "#ffc9c9",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 2,
  });
  API.updateScene({
    elements: [source],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  API.setSelectedElements([source]);
  return source;
};

describe("Add step toolbar", () => {
  it.each(["up", "right", "down", "left"] as LinkDirection[])(
    "creates and binds a styled successor %s",
    (direction) => {
      const source = seed();
      fireEvent.click(screen.getByRole("button", { name: /Add step$/ }));
      fireEvent.click(
        screen.getByRole("menuitem", { name: labels[direction] }),
      );
      expect(h.elements).toHaveLength(3);
      const next = API.getSelectedElements()[0];
      expect(next.id).not.toBe(source.id);
      expect(next).toMatchObject({
        type: source.type,
        width: source.width,
        height: source.height,
        strokeColor: source.strokeColor,
        backgroundColor: source.backgroundColor,
        strokeWidth: source.strokeWidth,
        fillStyle: source.fillStyle,
        roughness: source.roughness,
      });
      if (direction === "right") {
        expect(next.x).toBeGreaterThan(source.x);
      } else if (direction === "left") {
        expect(next.x).toBeLessThan(source.x);
      } else if (direction === "up") {
        expect(next.y).toBeLessThan(source.y);
      } else {
        expect(next.y).toBeGreaterThan(source.y);
      }
      const arrow = h.elements.find(
        (element) => element.type === "arrow",
      ) as ExcalidrawArrowElement;
      expect(arrow.startBinding?.elementId).toBe(source.id);
      expect(arrow.endBinding?.elementId).toBe(next.id);
    },
  );

  it("clones diamonds and undoes creation in one step", () => {
    seed("diamond");
    fireEvent.click(screen.getByRole("button", { name: /Add step$/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: labels.right }));
    expect(API.getSelectedElements()[0].type).toBe("diamond");
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress("z"));
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
  });

  it("previews without modifying the scene and cancels with Escape", () => {
    seed();
    fireEvent.click(screen.getByRole("button", { name: /Add step$/ }));
    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: labels.down }));
    expect(h.elements).toHaveLength(1);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole("menuitem", { name: labels.down }), {
      key: "Escape",
    });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(h.app.flowchart.pendingNodes).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Add step$/ }));
    expect(screen.getByRole("menuitem", { name: labels.right })).toHaveFocus();
  });

  it("supports directional keyboard focus and remembers the last direction", () => {
    seed();
    fireEvent.click(screen.getByRole("button", { name: /Add step$/ }));
    fireEvent.keyDown(screen.getByRole("menuitem", { name: labels.right }), {
      key: "ArrowDown",
    });
    const down = screen.getByRole("menuitem", { name: labels.down });
    expect(down).toHaveFocus();
    fireEvent.keyUp(down, { key: "ArrowDown" });
    expect(h.elements).toHaveLength(1);
    fireEvent.click(down);
    fireEvent.click(screen.getByRole("button", { name: /Add step$/ }));
    expect(screen.getByRole("menuitem", { name: labels.down })).toHaveFocus();
  });

  it.each([
    { viewModeEnabled: true },
    { selectedElementsAreBeingDragged: true },
    { isResizing: true },
    { isRotating: true },
  ])("hides during restricted states: %j", (state) => {
    seed();
    API.setAppState({
      viewModeEnabled: false,
      selectedElementsAreBeingDragged: false,
      isResizing: false,
      isRotating: false,
      ...state,
    });
    expect(screen.queryByRole("button", { name: /Add step$/ })).toBeNull();
  });

  it("hides for locked, unsupported, and multiple selected elements", () => {
    const locked = API.createElement({ type: "rectangle", locked: true });
    const ellipse = API.createElement({ type: "ellipse" });
    const diamond = API.createElement({ type: "diamond" });
    API.setElements([locked, ellipse, diamond]);
    for (const selection of [[locked], [ellipse], [ellipse, diamond], []]) {
      API.setSelectedElements(selection);
      expect(screen.queryByRole("button", { name: /Add step$/ })).toBeNull();
    }
  });

  it("hides while editing text and clears an open preview", () => {
    seed();
    fireEvent.click(screen.getByRole("button", { name: /Add step$/ }));
    const text = API.createElement({ type: "text", text: "Label" });
    API.setElements([...h.elements, text]);
    API.setAppState({ editingTextElement: text });
    expect(screen.queryByRole("button", { name: /Add step$/ })).toBeNull();
    expect(h.app.flowchart.pendingNodes).toBeNull();
  });

  it("tracks pan and zoom and flips below selections near the top edge", () => {
    seed();
    const toolbar = screen.getByRole("button", { name: /Add step$/ })
      .parentElement!;
    const before = toolbar.style.left;
    API.setAppState({ scrollX: 100, zoom: { value: getNormalizedZoom(2) } });
    expect(toolbar.style.left).not.toBe(before);
    API.setAppState({ scrollY: -400, zoom: { value: getNormalizedZoom(1) } });
    expect(Number.parseFloat(toolbar.style.top)).toBeGreaterThan(80);
    API.setAppState({ scrollX: -1000 });
    expect(Number.parseFloat(toolbar.style.left)).toBeGreaterThanOrEqual(8);
  });
});
