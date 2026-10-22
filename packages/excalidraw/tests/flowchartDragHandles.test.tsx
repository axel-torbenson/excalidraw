import { fireEvent, screen } from "@testing-library/react";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

import type { AppState } from "../types";

unmountComponent();
const { h } = window;
const directions = ["up", "right", "down", "left"] as const;
const starts = {
  up: [400, 264],
  right: [536, 350],
  down: [400, 436],
  left: [264, 350],
};
const ends = {
  up: [400, 100],
  right: [800, 350],
  down: [400, 700],
  left: [100, 350],
};
const pointer = (x: number, y: number) => ({
  clientX: x,
  clientY: y,
  pointerId: 1,
  button: 0,
});

beforeEach(async () => {
  await render(<Excalidraw handleKeyboardGlobally />);
  API.setAppState({ width: 1000, height: 1000, scrollX: 0, scrollY: 0 });
});

const selectSource = (type: "rectangle" | "diamond" = "rectangle") => {
  const source = API.createElement({
    type,
    x: 300,
    y: 300,
    width: 200,
    height: 100,
    strokeColor: "#c92a2a",
    backgroundColor: "#ffc9c9",
    fillStyle: "solid",
    strokeStyle: "dashed",
    strokeWidth: 2,
    opacity: 70,
    roughness: 2,
  });
  API.updateScene({
    elements: [source],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  API.setSelectedElements([source]);
  return source;
};

const begin = (direction: typeof directions[number]) => {
  fireEvent.pointerDown(
    screen.getByTestId(`flowchart-drag-${direction}`),
    pointer(...(starts[direction] as [number, number])),
  );
};
const move = (x: number, y: number) =>
  fireEvent.pointerMove(h.app.ownerDocument, pointer(x, y));
const end = (x: number, y: number) =>
  fireEvent.pointerUp(h.app.ownerDocument, pointer(x, y));

describe.each(["rectangle", "diamond"] as const)("%s drag handles", (type) => {
  it.each(directions)(
    "creates and binds a styled node %s in one undo step",
    (direction) => {
      const source = selectSource(type);
      const historyBefore = API.getUndoStack().length;
      begin(direction);
      const [x, y] = ends[direction];
      move(x, y);
      expect(h.elements).toHaveLength(1);
      expect(source.boundElements).toBeNull();
      expect(h.app.flowchart.pendingNodes).toHaveLength(2);
      end(x, y);

      expect(h.elements).toHaveLength(3);
      const node = h.elements[1];
      const arrow = h.elements[2];
      expect(node).toMatchObject({
        type,
        width: source.width,
        height: source.height,
        strokeColor: source.strokeColor,
        backgroundColor: source.backgroundColor,
        fillStyle: source.fillStyle,
        strokeStyle: source.strokeStyle,
        strokeWidth: source.strokeWidth,
        opacity: source.opacity,
        roughness: source.roughness,
      });
      expect(arrow).toMatchObject({
        type: "arrow",
        startBinding: { elementId: source.id },
        endBinding: { elementId: node.id },
      });
      expect(h.state.selectedElementIds).toEqual({ [node.id]: true });
      expect(API.getUndoStack()).toHaveLength(historyBefore + 1);
      Keyboard.undo();
      expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(
        1,
      );
      expect(h.elements[0].boundElements ?? []).toHaveLength(0);
      Keyboard.redo();
      expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(
        3,
      );
    },
  );
});

it.each(["escape", "inside", "threshold", "cancel", "blur"])(
  "%s cancels without mutating the scene or history",
  (kind) => {
    const source = selectSource();
    const original = JSON.stringify(h.elements);
    const historyBefore = API.getUndoStack().length;
    begin("right");
    move(800, 350);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    if (kind === "escape") {
      fireEvent.keyDown(h.app.ownerDocument, { key: "Escape" });
      end(800, 350);
    } else if (kind === "inside") {
      end(400, 350);
    } else if (kind === "threshold") {
      end(537, 350);
    } else if (kind === "blur") {
      fireEvent.blur(h.app.ownerWindow);
    } else {
      fireEvent.pointerCancel(h.app.ownerDocument, pointer(800, 350));
    }
    expect(JSON.stringify(h.elements)).toEqual(original);
    expect(source.boundElements).toBeNull();
    expect(API.getUndoStack()).toHaveLength(historyBefore);
    expect(h.app.flowchart.pendingNodes).toBeNull();
  },
);

it.each(directions)("click creates at default placement %s", (direction) => {
  selectSource();
  begin(direction);
  end(...(starts[direction] as [number, number]));
  expect(h.elements).toHaveLength(3);
});

it("supports keyboard activation of a focused handle", () => {
  selectSource();
  fireEvent.keyDown(screen.getByTestId("flowchart-drag-right"), {
    key: "Enter",
  });
  expect(h.elements).toHaveLength(3);
});

it("follows the pointer while retaining the handle direction", () => {
  selectSource();
  begin("right");
  move(850, 600);
  expect(h.app.flowchart.pendingNodes?.[0]).toMatchObject({ x: 750, y: 550 });
  end(850, 600);
  expect(h.elements[1]).toMatchObject({ x: 750, y: 550 });
});

it("uses existing collision avoidance when dropping over a connected node", () => {
  const source = selectSource();
  begin("right");
  end(...(starts.right as [number, number]));
  const existing = h.elements[1];
  API.setSelectedElements([source]);
  begin("right");
  const x = existing.x + existing.width / 2;
  const y = existing.y + existing.height / 2;
  move(x, y);
  const preview = h.app.flowchart.pendingNodes?.[0];
  expect(preview?.x).toBe(existing.x);
  expect(preview?.y).not.toBe(existing.y);
  end(x, y);
  const added = h.elements[3];
  expect(
    added.y + added.height <= existing.y ||
      added.y >= existing.y + existing.height,
  ).toBe(true);
});

it("keeps controls screen-sized and outside transform handles when zoomed", () => {
  selectSource();
  API.setAppState({ zoom: { value: 0.5 as AppState["zoom"]["value"] } });
  const right = screen.getByTestId("flowchart-drag-right");
  expect(right.style.left).toBe("286px");
  expect(right.style.top).toBe("175px");
});

it.each([
  { viewModeEnabled: true },
  { selectedElementsAreBeingDragged: true },
  { isResizing: true },
  { isRotating: true },
  { activeTool: { type: "rectangle" } },
] as Partial<AppState>[])("hides controls during %j", (state) => {
  selectSource();
  expect(screen.getAllByTestId(/^flowchart-drag-/)).toHaveLength(4);
  API.setAppState((previous) => ({ ...previous, ...state }));
  expect(screen.queryAllByTestId(/^flowchart-drag-/)).toHaveLength(0);
});

it("hides for locked shapes, multiple selections, ellipses and no selection", () => {
  const source = selectSource();
  const other = API.createElement({ type: "rectangle" });
  API.setElements([source, other]);
  API.setSelectedElements([source, other]);
  expect(screen.queryAllByTestId(/^flowchart-drag-/)).toHaveLength(0);
  API.clearSelection();
  expect(screen.queryAllByTestId(/^flowchart-drag-/)).toHaveLength(0);
  const ellipse = API.createElement({ type: "ellipse" });
  API.setElements([ellipse]);
  API.setSelectedElements([ellipse]);
  expect(screen.queryAllByTestId(/^flowchart-drag-/)).toHaveLength(0);
  const locked = API.createElement({ type: "rectangle", locked: true });
  API.setElements([locked]);
  API.setSelectedElements([locked]);
  expect(screen.queryAllByTestId(/^flowchart-drag-/)).toHaveLength(0);
});
