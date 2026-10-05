import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, render, screen, unmountComponent } from "./test-utils";

unmountComponent();

const h = window.h;

const labels = {
  up: "Create a connected node above",
  right: "Create a connected node to the right",
  down: "Create a connected node below",
  left: "Create a connected node to the left",
} as const;

const makeNode = (type: "rectangle" | "diamond" | "ellipse" | "stickynote") =>
  API.createElement({
    type,
    x: 100,
    y: 100,
    width: 120,
    height: 80,
    ...(type === "stickynote" ? { baseHeight: 60 } : {}),
  });

describe("flowchart directional controls", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  afterEach(() => {
    unmountComponent();
  });

  const selectNode = (node: ReturnType<typeof makeNode>) => {
    API.updateScene({
      elements: [node],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([node]);
  };

  it.each([
    ["up", { x: 100, y: -80 }],
    ["right", { x: 320, y: 100 }],
    ["down", { x: 100, y: 280 }],
    ["left", { x: -120, y: 100 }],
  ] as const)("creates and binds a node %s", (direction, position) => {
    const source = makeNode("rectangle");
    selectNode(source);
    const undoCount = API.getUndoStack().length;

    fireEvent.click(screen.getByRole("button", { name: labels[direction] }));

    const createdNode = h.elements.find(
      (element) => element.id !== source.id && element.type === "rectangle",
    );
    const arrow = h.elements.find((element) => element.type === "arrow");
    expect(createdNode).toMatchObject({
      type: "rectangle",
      x: position.x,
      y: position.y,
      width: source.width,
      height: source.height,
      strokeColor: source.strokeColor,
      backgroundColor: source.backgroundColor,
    });
    expect(arrow).toMatchObject({
      startBinding: { elementId: source.id },
      endBinding: { elementId: createdNode?.id },
    });
    expect(API.getSelectedElements()).toEqual([createdNode]);
    expect(API.getUndoStack()).toHaveLength(undoCount + 1);

    Keyboard.undo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
    expect(h.elements.find((element) => !element.isDeleted)?.id).toBe(
      source.id,
    );
  });

  it("clones a diamond and selects it", () => {
    const source = makeNode("diamond");
    selectNode(source);

    fireEvent.click(screen.getByRole("button", { name: labels.right }));

    expect(
      h.elements.find((element) => element.id !== source.id),
    ).toMatchObject({
      type: "diamond",
      x: 320,
      y: 100,
    });
    expect(API.getSelectedElement()).toMatchObject({ type: "diamond" });
  });

  it("extends the flowchart on repeated clicks without overlapping nodes", () => {
    const source = makeNode("rectangle");
    selectNode(source);

    fireEvent.click(screen.getByRole("button", { name: labels.right }));
    fireEvent.click(screen.getByRole("button", { name: labels.right }));

    const rectangles = h.elements.filter(
      (element) => !element.isDeleted && element.type === "rectangle",
    );
    expect(rectangles).toHaveLength(3);
    expect(rectangles[1].x).toBe(320);
    expect(rectangles[2].x).toBe(540);
  });

  it.each(["ellipse", "stickynote"] as const)(
    "does not show controls for %s",
    (type) => {
      selectNode(makeNode(type));
      expect(
        screen.queryByRole("button", { name: labels.right }),
      ).not.toBeInTheDocument();
    },
  );

  it("does not show controls for multiple selected elements", () => {
    const rectangle = makeNode("rectangle");
    const diamond = makeNode("diamond");
    API.updateScene({
      elements: [rectangle, diamond],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([rectangle, diamond]);

    expect(
      screen.queryByRole("button", { name: labels.right }),
    ).not.toBeInTheDocument();
  });

  it("does not show controls for a locked element", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      locked: true,
    });
    selectNode(rectangle);

    expect(
      screen.queryByRole("button", { name: labels.right }),
    ).not.toBeInTheDocument();
  });
});
