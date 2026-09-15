import { KEYS, reseed } from "@excalidraw/common";
import {
  FLOWCHART_HANDLE_OFFSET,
  getFlowchartHandlePosition,
  getTransformHandlesFromCoords,
} from "@excalidraw/element";

import {
  Excalidraw,
  sceneCoordsToViewportCoords,
} from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI, Keyboard, Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  render,
  unmountComponent,
  fireEvent,
  GlobalTestState,
} from "@excalidraw/excalidraw/tests/test-utils";

import type {
  ExcalidrawTextElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();

  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 1000;

  // The bounds of hand-drawn linear elements may change after flipping, so
  // removing this style for testing
  UI.clickTool("arrow");
  UI.clickByTitle("Architect");
  UI.clickTool("selection");
});

describe("flow chart creation", () => {
  beforeEach(() => {
    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
  });

  // multiple at once
  it("create multiple successor nodes at once", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(5);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(3);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(2);
  });

  it("when directions are changed, only the last same directions will apply", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);

      Keyboard.keyPress(KEYS.ARROW_LEFT);

      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_UP);
    });

    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(7);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(4);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(3);
  });

  it("when escaped, no nodes will be created", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    Keyboard.keyPress(KEYS.ESCAPE);
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(1);
  });

  it("create nodes one at a time", () => {
    const initialNode = h.elements[0];

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(3);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(2);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(1);

    const firstChildNode = h.elements.filter(
      (el) => el.type === "rectangle" && el.id !== initialNode.id,
    )[0];
    expect(firstChildNode).not.toBe(null);
    expect(firstChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    API.setSelectedElements([initialNode] as NonDeletedExcalidrawElement[]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(5);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(3);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(2);

    const secondChildNode = h.elements.filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== initialNode.id &&
        el.id !== firstChildNode.id,
    )[0];
    expect(secondChildNode).not.toBe(null);
    expect(secondChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    API.setSelectedElements([initialNode] as NonDeletedExcalidrawElement[]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(7);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(4);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(3);

    const thirdChildNode = h.elements.filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== initialNode.id &&
        el.id !== firstChildNode.id &&
        el.id !== secondChildNode.id,
    )[0];

    expect(thirdChildNode).not.toBe(null);
    expect(thirdChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    expect(firstChildNode.x).toBe(secondChildNode.x);
    expect(secondChildNode.x).toBe(thirdChildNode.x);
  });

  it("creates a connected styled node by dragging a directional handle", () => {
    const source = h.elements[0];
    const handleX = source.x + source.width + FLOWCHART_HANDLE_OFFSET;
    const handleY = source.y + source.height / 2;

    mouse.downAt(handleX, handleY);
    expect(h.elements).toHaveLength(1);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);

    mouse.moveTo(500, handleY);
    const preview = h.app.flowchart.pendingNodes?.find(
      (element) => element.type === "rectangle",
    );
    expect(preview?.x).toBe(400);
    expect(preview?.y).toBe(source.y);

    mouse.up();

    const child = h.elements.find(
      (element) => element.type === "rectangle" && element.id !== source.id,
    );
    const arrow = h.elements.find((element) => element.type === "arrow");
    expect(child).toMatchObject({
      x: preview?.x,
      y: preview?.y,
      width: source.width,
      height: source.height,
      backgroundColor: source.backgroundColor,
      strokeColor: source.strokeColor,
      strokeWidth: source.strokeWidth,
    });
    expect(arrow).toMatchObject({
      startBinding: { elementId: source.id },
      endBinding: { elementId: child?.id },
    });
    expect(h.app.flowchart.pendingNodes).toBeNull();

    expect(API.getUndoStack()).toHaveLength(1);
    Keyboard.undo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(0);
    Keyboard.redo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(3);
  });

  it("supports dragging handles from a diamond", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    API.setElements([diamond]);
    API.setSelectedElements([diamond]);

    mouse.downAt(
      diamond.x + diamond.width / 2,
      diamond.y - FLOWCHART_HANDLE_OFFSET,
    );
    mouse.upAt(diamond.x + diamond.width / 2, diamond.y - 250);

    expect(
      h.elements.filter((element) => element.type === "diamond"),
    ).toHaveLength(2);
    expect(
      h.elements.filter((element) => element.type === "arrow"),
    ).toHaveLength(1);
  });

  it("leaves the rotation handle usable above flowchart handles", () => {
    const source = h.elements[0];
    const transformHandles = getTransformHandlesFromCoords(
      [
        source.x,
        source.y,
        source.x + source.width,
        source.y + source.height,
        source.x + source.width / 2,
        source.y + source.height / 2,
      ],
      source.angle,
      h.state.zoom,
      "mouse",
    );
    const rotationHandle = transformHandles.rotation;
    expect(rotationHandle).toBeDefined();
    const rotationX = rotationHandle![0] + rotationHandle![2] / 2;
    const rotationY = rotationHandle![1] + rotationHandle![3] / 2;
    const upFlowchartHandle = getFlowchartHandlePosition(
      source,
      "up",
      h.state.zoom.value,
    );

    expect(upFlowchartHandle.y + 10).toBeLessThan(rotationY - 4);

    mouse.downAt(rotationX, rotationY);
    mouse.moveTo(rotationX + 20, rotationY + 20);
    mouse.up();
    expect(h.elements[0].angle).not.toBe(0);
  });

  it("hides and disables handles while text editing is active", () => {
    const source = h.elements[0] as NonDeletedExcalidrawElement;
    const text = API.createElement({
      type: "text",
      text: "editing",
      width: 100,
      height: 20,
    }) as NonDeleted<ExcalidrawTextElement>;
    API.setElements([source, text]);
    API.setSelectedElements([source]);
    API.setAppState({ editingTextElement: text });

    mouse.downAt(
      source.x + source.width + FLOWCHART_HANDLE_OFFSET,
      source.y + source.height / 2,
    );

    expect(h.app.flowchart.pendingNodes).toBeNull();
    expect(h.elements).toHaveLength(2);
  });

  it("cancels a handle drag without inserting or capturing a change", () => {
    const source = h.elements[0];
    mouse.downAt(
      source.x + source.width + FLOWCHART_HANDLE_OFFSET,
      source.y + source.height / 2,
    );
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);

    Keyboard.keyPress(KEYS.ESCAPE);
    mouse.up();

    expect(h.elements).toHaveLength(1);
    expect(h.app.flowchart.pendingNodes).toBeNull();
    Keyboard.undo();
    expect(h.elements).toHaveLength(1);
  });

  it("does not commit a pointer drag on modifier key release", () => {
    const source = h.elements[0];
    mouse.downAt(
      source.x + source.width + FLOWCHART_HANDLE_OFFSET,
      source.y + source.height / 2,
    );
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);

    Keyboard.keyDown(KEYS.CTRL_OR_CMD);
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements).toHaveLength(1);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    const pendingBeforeArrow = h.app.flowchart.pendingNodes?.[0];
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    expect(h.app.flowchart.pendingNodes?.[0]).toMatchObject({
      x: pendingBeforeArrow?.x,
      y: pendingBeforeArrow?.y,
    });
    mouse.upAt(500, source.y + source.height / 2);
    expect(h.elements).toHaveLength(3);
    expect(
      h.elements.find(
        (element) => element.type === "rectangle" && element.id !== source.id,
      )?.x,
    ).toBe(400);
  });

  it("swallows movement after Escape until the pointer is released", () => {
    const source = h.elements[0];
    mouse.downAt(
      source.x + source.width + FLOWCHART_HANDLE_OFFSET,
      source.y + source.height / 2,
    );
    Keyboard.keyPress(KEYS.ESCAPE);

    expect(h.app.flowchart.pendingNodes).toBeNull();
    mouse.moveTo(500, source.y + source.height / 2);
    expect(h.elements).toHaveLength(1);
    mouse.up();
    expect(h.elements).toHaveLength(1);
  });

  it("cancels a handle drag on pointercancel", () => {
    const source = h.elements[0];
    mouse.downAt(
      source.x + source.width + FLOWCHART_HANDLE_OFFSET,
      source.y + source.height / 2,
    );
    fireEvent.pointerCancel(GlobalTestState.interactiveCanvas, {
      pointerId: 1,
      pointerType: "mouse",
    });

    expect(h.elements).toHaveLength(1);
    expect(h.app.flowchart.pendingNodes).toBeNull();
  });

  it("hits handles using zoom and scroll-adjusted viewport coordinates", () => {
    const source = h.elements[0];
    API.setAppState({
      zoom: { value: 0.5 as typeof h.state.zoom.value },
      scrollX: -120,
      scrollY: 80,
    });

    const handle = getFlowchartHandlePosition(
      source,
      "right",
      h.state.zoom.value,
    );
    expect(handle.x).toBe(
      source.x + source.width + FLOWCHART_HANDLE_OFFSET / h.state.zoom.value,
    );
    const viewportHandle = sceneCoordsToViewportCoords(
      {
        sceneX: handle.x,
        sceneY: handle.y,
      },
      h.state,
    );

    mouse.downAt(viewportHandle.x, viewportHandle.y);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    mouse.upAt(viewportHandle.x + 100, viewportHandle.y);
    expect(h.elements).toHaveLength(3);
  });

  // regression for #8518: additional siblings must not overlap existing ones
  it("does not overlap existing siblings when adding more children (down)", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 400,
      height: 300,
    });
    API.setElements([parent]);
    API.setSelectedElements([parent]);

    for (let i = 0; i < 4; i++) {
      API.setSelectedElements([parent]);
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.ARROW_DOWN);
      });
      Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    }

    const children = h.elements.filter(
      (el) => el.type === "rectangle" && el.id !== parent.id,
    );
    expect(children.length).toBe(4);

    // all siblings should sit on the same row (no vertical misalignment)
    const ys = new Set(children.map((c) => c.y));
    expect(ys.size).toBe(1);

    // no two siblings should overlap horizontally
    const sorted = [...children].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].x).toBeGreaterThanOrEqual(
        sorted[i - 1].x + sorted[i - 1].width,
      );
    }
  });

  // regression for #8518: a second batch of children (added by holding the
  // modifier and pressing the arrow several times) must clear the first batch
  it("does not overlap a previous batch of children (down)", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 400,
      height: 300,
    });
    API.setElements([parent]);

    // hold the modifier and press down N times to create a batch at once
    const addBatch = (count: number) => {
      API.setSelectedElements([parent]);
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        for (let i = 0; i < count; i++) {
          Keyboard.keyPress(KEYS.ARROW_DOWN);
        }
      });
      Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    };

    addBatch(3);
    addBatch(2);

    const children = h.elements.filter(
      (el) => el.type === "rectangle" && el.id !== parent.id,
    );
    expect(children.length).toBe(5);

    const overlaps = (a: typeof children[0], b: typeof children[0]) =>
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;

    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        expect(overlaps(children[i], children[j])).toBe(false);
      }
    }
  });

  // regression for #8518: a new child must also clear nodes that aren't the
  // start node's direct siblings but sit where it would land — e.g. a sibling
  // reached through a shared parent
  it("does not overlap a sibling reached through a shared parent", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);

    // two right-children stack into a column to the right of the parent
    API.setSelectedElements([parent]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    const rightChildren = h.elements
      .filter((el) => el.type === "rectangle" && el.id !== parent.id)
      .sort((a, b) => a.y - b.y);
    expect(rightChildren.length).toBe(2);
    const [upper, lower] = rightChildren;

    // add a child below the upper sibling; it must not land on the lower one
    // that sits directly beneath it
    API.setSelectedElements([upper] as NonDeletedExcalidrawElement[]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    const newChild = h.elements.filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== parent.id &&
        el.id !== upper.id &&
        el.id !== lower.id,
    )[0];
    expect(newChild).toBeTruthy();

    const overlaps = (a: typeof newChild, b: typeof lower) =>
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;

    expect(overlaps(newChild, lower)).toBe(false);
  });
});

describe("flow chart band-search placement", () => {
  const addChild = (parent: NonDeletedExcalidrawElement, key: string) => {
    API.setSelectedElements([parent]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(key);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
  };

  const children = (parent: NonDeletedExcalidrawElement) =>
    h.elements.filter((el) => el.type === "rectangle" && el.id !== parent.id);

  const pendingRects = () =>
    (h.app.flowchart.pendingNodes ?? [])
      .filter((el) => el.type === "rectangle")
      .map((el) => ({ x: el.x, y: el.y }));

  it("places the first child exactly one offset away in every direction", () => {
    const cases = [
      { key: KEYS.ARROW_RIGHT, x: 300, y: 0 },
      { key: KEYS.ARROW_LEFT, x: -300, y: 0 },
      { key: KEYS.ARROW_DOWN, x: 0, y: 200 },
      { key: KEYS.ARROW_UP, x: 0, y: -200 },
    ];

    for (const { key, x, y } of cases) {
      API.clearSelection();
      const parent = API.createElement({
        type: "rectangle",
        width: 200,
        height: 100,
      });
      API.setElements([parent]);

      addChild(parent, key);

      const [child] = children(parent);
      expect(child).toBeTruthy();
      expect(child.x).toBe(x);
      expect(child.y).toBe(y);
    }
  });

  it("slides into the nearest free gap between obstacles without moving them", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);

    addChild(parent, KEYS.ARROW_DOWN);
    addChild(parent, KEYS.ARROW_DOWN);

    const [c1, c2] = children(parent).sort((a, b) => a.x - b.x);
    expect([c1.x, c2.x]).toEqual([0, 300]);

    // widen the gap between the siblings so a third child fits in between
    API.updateElement(c2, { x: 600 });

    addChild(parent, KEYS.ARROW_DOWN);

    const c3 = children(parent).find(
      (el) => el.id !== c1.id && el.id !== c2.id,
    )!;
    expect({ x: c3.x, y: c3.y }).toEqual({ x: 300, y: 200 });

    // the obstacles were not moved
    expect({ x: c1.x, y: c1.y }).toEqual({ x: 0, y: 200 });
    expect({ x: c2.x, y: c2.y }).toEqual({ x: 600, y: 200 });
  });

  it("keeps pending nodes in place while the cluster grows", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);
    API.setSelectedElements([parent]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([{ x: 300, y: 0 }]);

      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([
        { x: 300, y: 0 },
        { x: 300, y: 200 },
      ]);

      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([
        { x: 300, y: -200 },
        { x: 300, y: 0 },
        { x: 300, y: 200 },
      ]);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
  });

  it("repositions the whole pending cluster when it no longer fits", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);

    // box in the space right of the parent, leaving room for a single node
    addChild(parent, KEYS.ARROW_RIGHT);
    const [c1] = children(parent);
    API.updateElement(c1, { y: -300 });

    addChild(parent, KEYS.ARROW_RIGHT);
    const c2 = children(parent).find((el) => el.id !== c1.id)!;
    expect({ x: c2.x, y: c2.y }).toEqual({ x: 300, y: 0 });
    API.updateElement(c2, { y: 300 });

    API.setSelectedElements([parent]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([{ x: 300, y: 0 }]);

      // growing cannot extend at either end, so the cluster moves as a whole
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([
        { x: 300, y: -100 },
        { x: 300, y: 100 },
      ]);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    // the obstacles were not moved
    expect({ x: c1.x, y: c1.y }).toEqual({ x: 300, y: -300 });
    expect({ x: c2.x, y: c2.y }).toEqual({ x: 300, y: 300 });
  });
});

describe("flow chart navigation", () => {
  it("single node at each level", () => {
    /**
     * ▨ -> ▨ -> ▨ -> ▨ -> ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(5);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(4);

    // all the way to the left, gets us to the first node
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    // all the way to the right, gets us to the last node
    const rightMostNode = h.elements[h.elements.length - 2];
    expect(rightMostNode);
    expect(rightMostNode.type).toBe("rectangle");
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);
  });

  it("multiple nodes at each level", () => {
    /**
     * from the perspective of the first node, there're four layers, and
     * there are four nodes at the second layer
     *
     *   -> ▨
     * ▨ -> ▨ -> ▨ -> ▨ -> ▨
     *   -> ▨
     *   -> ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    const secondNode = h.elements[1];
    const rightMostNode = h.elements[h.elements.length - 2];

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    API.setSelectedElements([rectangle]);

    // because of same level cycling,
    // going right five times should take us back to the second node again
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[secondNode.id]).toBe(true);

    // from the second node, going right three times should take us to the rightmost node
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
  });

  it("take the most obvious link when possible", () => {
    /**
     * ▨ → ▨   ▨ → ▨
     *     ↓   ↑
     *     ▨ → ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    // last node should be the one that's selected
    const rightMostNode = h.elements[h.elements.length - 2];
    expect(rightMostNode.type).toBe("rectangle");
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);

    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    // going any direction takes us to the predecessor as well
    const predecessorToRightMostNode = h.elements[h.elements.length - 4];
    expect(predecessorToRightMostNode.type).toBe("rectangle");

    API.setSelectedElements([rightMostNode] as NonDeletedExcalidrawElement[]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
    API.setSelectedElements([rightMostNode] as NonDeletedExcalidrawElement[]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
    API.setSelectedElements([rightMostNode] as NonDeletedExcalidrawElement[]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
  });
});
