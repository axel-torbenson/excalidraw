import { KEYS, reseed } from "@excalidraw/common";

import { Excalidraw } from "@excalidraw/excalidraw";
import { CaptureUpdateAction } from "@excalidraw/element";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { getTextEditor } from "./queries/dom";

unmountComponent();

const { h } = window;
const POINTER_ID = 4;

const pointerEvent = (clientX: number, clientY: number) => ({
  button: 0,
  clientX,
  clientY,
  pointerId: POINTER_ID,
  pointerType: "mouse",
});

const getHandle = (direction: "up" | "right" | "down" | "left") =>
  screen.getByTestId(`flowchart-create-handle-${direction}`);

let source: NonDeletedExcalidrawElement;

beforeEach(async () => {
  localStorage.clear();
  reseed(17);
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  API.setAppState({
    width: 1000,
    height: 1000,
    offsetLeft: 0,
    offsetTop: 0,
    scrollX: 0,
    scrollY: 0,
  });
  source = API.createElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 120,
    height: 60,
    strokeColor: "#2445a8",
    backgroundColor: "#f4d67a",
    fillStyle: "solid",
    strokeWidth: 3,
    roughness: 1,
  });
  API.setElements([source]);
  API.setSelectedElements([source]);
  act(() => {
    h.app.syncActionResult({
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  });
});

afterEach(() => {
  unmountComponent();
});

describe("flowchart drag-to-create handles", () => {
  it.each([
    ["up", 100, -60],
    ["right", 320, 100],
    ["down", 100, 260],
    ["left", -120, 100],
  ] as const)(
    "clicking the %s handle creates a default-position node",
    (direction, x, y) => {
      const button = getHandle(direction);
      fireEvent.pointerDown(button, pointerEvent(220, 130));
      fireEvent.pointerUp(button, pointerEvent(220, 130));

      const createdNode = h.elements.find(
        (element) => element.id !== source.id && element.type === "rectangle",
      );
      const arrow = h.elements.find((element) => element.type === "arrow");

      expect(createdNode).toMatchObject({ type: "rectangle", x, y });
      expect(arrow).toMatchObject({
        startBinding: { elementId: source.id },
        endBinding: { elementId: createdNode?.id },
      });
      expect(API.getSelectedElement().id).toBe(createdNode?.id);
    },
  );

  it("previews a dragged node, preserves style and size, binds it, selects it, and records one undo step", () => {
    const originalBindings = source.boundElements;
    const undoDepth = API.getUndoStack().length;
    const button = getHandle("right");
    fireEvent.pointerDown(button, pointerEvent(240, 130));
    fireEvent.pointerMove(button, pointerEvent(600, 400));

    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    expect(source.boundElements).toEqual(originalBindings);
    expect(button.parentElement).toHaveStyle({ visibility: "hidden" });

    fireEvent.pointerUp(button, pointerEvent(600, 400));

    const createdNode = h.elements.find(
      (element) => element.id !== source.id && element.type === "rectangle",
    );
    const arrow = h.elements.find((element) => element.type === "arrow");

    expect(createdNode).toMatchObject({
      type: "rectangle",
      x: 540,
      y: 370,
      width: source.width,
      height: source.height,
      strokeColor: source.strokeColor,
      backgroundColor: source.backgroundColor,
      fillStyle: source.fillStyle,
      strokeWidth: source.strokeWidth,
      roughness: source.roughness,
    });
    expect(arrow).toMatchObject({
      startBinding: { elementId: source.id },
      endBinding: { elementId: createdNode?.id },
    });
    expect(API.getSelectedElement().id).toBe(createdNode?.id);
    expect(API.getUndoStack()).toHaveLength(undoDepth + 1);

    expect(document.activeElement).toHaveClass("excalidraw-container");
    Keyboard.undo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
    expect(h.elements[0].id).toBe(source.id);
  });

  it("focuses the new node so Enter opens its label editor", async () => {
    const button = getHandle("right");
    fireEvent.pointerDown(button, pointerEvent(240, 130));
    fireEvent.pointerMove(button, pointerEvent(600, 400));
    fireEvent.pointerUp(button, pointerEvent(600, 400));

    expect(document.activeElement).toHaveClass("excalidraw-container");
    Keyboard.keyPress(KEYS.ENTER);
    expect(await getTextEditor()).not.toBeNull();
  });

  it("snaps the dragged node to the active grid", () => {
    API.setAppState({ gridModeEnabled: true, gridSize: 20 });
    const button = getHandle("down");
    fireEvent.pointerDown(button, pointerEvent(220, 160));
    fireEvent.pointerMove(button, pointerEvent(513, 417));
    fireEvent.pointerUp(button, pointerEvent(513, 417));

    const createdNode = h.elements.find(
      (element) => element.id !== source.id && element.type === "rectangle",
    );
    expect(createdNode).toMatchObject({ x: 460, y: 380 });
  });

  it("connects to an existing flowchart node when dropped on it", () => {
    const target = API.createElement({
      type: "diamond",
      x: 500,
      y: 200,
      width: 140,
      height: 80,
      backgroundColor: "#a6d8c9",
      fillStyle: "solid",
    });
    API.setElements([source, target]);
    API.setSelectedElements([source]);

    const button = getHandle("right");
    fireEvent.pointerDown(button, pointerEvent(240, 130));
    fireEvent.pointerMove(button, pointerEvent(560, 240));
    fireEvent.pointerUp(button, pointerEvent(560, 240));

    expect(h.elements).toHaveLength(3);
    expect(
      h.elements.find((element) => element.type === "arrow"),
    ).toMatchObject({
      startBinding: { elementId: source.id },
      endBinding: { elementId: target.id },
    });
    expect(API.getSelectedElement().id).toBe(target.id);
  });

  it("cancels on Escape without inserting elements or recording history", () => {
    const undoDepth = API.getUndoStack().length;
    const button = getHandle("right");
    fireEvent.pointerDown(button, pointerEvent(240, 130));
    fireEvent.pointerMove(button, pointerEvent(600, 400));
    Keyboard.keyPress("Escape");
    fireEvent.pointerUp(button, pointerEvent(600, 400));

    expect(h.elements).toHaveLength(1);
    expect(API.getUndoStack()).toHaveLength(undoDepth);
    expect(h.app.flowchart.pendingNodes).toBeNull();
  });

  it("cancels when a moved gesture returns near the origin handle", () => {
    const undoDepth = API.getUndoStack().length;
    const button = getHandle("right");
    fireEvent.pointerDown(button, pointerEvent(240, 130));
    fireEvent.pointerMove(button, pointerEvent(400, 300));
    fireEvent.pointerMove(button, pointerEvent(244, 133));
    fireEvent.pointerUp(button, pointerEvent(244, 133));

    expect(h.elements).toHaveLength(1);
    expect(API.getUndoStack()).toHaveLength(undoDepth);
  });

  it("shows handles for rectangles and diamonds, but not unsupported or ineligible selections", () => {
    expect(getHandle("up")).toBeTruthy();

    const diamond = API.createElement({ type: "diamond", x: 300, y: 100 });
    API.setElements([diamond]);
    API.setSelectedElements([diamond]);
    expect(getHandle("up")).toBeTruthy();

    const ellipse = API.createElement({ type: "ellipse", x: 500, y: 100 });
    API.setElements([ellipse]);
    API.setSelectedElements([ellipse]);
    expect(screen.queryByTestId("flowchart-create-handle-up")).toBeNull();

    const locked = API.createElement({
      type: "rectangle",
      x: 700,
      y: 100,
      locked: true,
    });
    API.setElements([locked]);
    API.setSelectedElements([locked]);
    expect(screen.queryByTestId("flowchart-create-handle-up")).toBeNull();
  });

  it("hides handles for multi-selection, view mode, resizing, rotation, and text editing", () => {
    const second = API.createElement({ type: "rectangle", x: 300, y: 100 });
    API.setElements([source, second]);
    API.setSelectedElements([source, second]);
    expect(screen.queryByTestId("flowchart-create-handle-up")).toBeNull();

    API.setSelectedElements([source]);
    API.setAppState({ viewModeEnabled: true });
    expect(screen.queryByTestId("flowchart-create-handle-up")).toBeNull();

    API.setAppState({ viewModeEnabled: false, resizingElement: source });
    expect(screen.queryByTestId("flowchart-create-handle-up")).toBeNull();

    API.setAppState({ resizingElement: null, isRotating: true });
    expect(screen.queryByTestId("flowchart-create-handle-up")).toBeNull();

    API.setAppState({ isRotating: false, editingTextElement: source as any });
    expect(screen.queryByTestId("flowchart-create-handle-up")).toBeNull();
  });

  it("does not expose handles when interaction is read-only", async () => {
    unmountComponent();
    await render(<Excalidraw interaction={false} />);
    source = API.createElement({ type: "rectangle", x: 100, y: 100 });
    API.setElements([source]);
    API.setSelectedElements([source]);
    expect(screen.queryByTestId("flowchart-create-handle-up")).toBeNull();
  });
});
