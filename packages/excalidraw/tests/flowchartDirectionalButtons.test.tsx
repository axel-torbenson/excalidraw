import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  fireEvent,
  render,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";
import { getTextEditor } from "./queries/dom";

const { h } = window;

const createAndSelectNode = (
  type: "rectangle" | "diamond" | "ellipse" = "rectangle",
  locked = false,
) => {
  const node = API.createElement({
    type,
    x: 40,
    y: 60,
    width: 160,
    height: 80,
    backgroundColor: "#aabbcc",
    strokeColor: "#112233",
    strokeWidth: 3,
    locked,
  });

  API.updateScene({
    elements: [node],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  API.setSelectedElements([node]);
  return node;
};

describe("flowchart directional controls", () => {
  beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
  });

  it.each([
    ["up", "Add shape above", { x: 40, y: -120 }],
    ["right", "Add shape to the right", { x: 300, y: 60 }],
    ["down", "Add shape below", { x: 40, y: 240 }],
    ["left", "Add shape to the left", { x: -220, y: 60 }],
  ] as const)(
    "creates and selects one connected node in the %s direction",
    async (_direction, label, position) => {
      const source = createAndSelectNode();
      const undoCount = API.getUndoStack().length;
      const button = screen.getByRole("button", { name: label });

      fireEvent.pointerDown(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(API.getSelectedElement().id).not.toBe(source.id);
      });

      const created = API.getSelectedElement();
      const arrow = h.elements.find(
        (element) => element.type === "arrow" && !element.isDeleted,
      );

      expect(created).toMatchObject({
        type: "rectangle",
        x: position.x,
        y: position.y,
        width: source.width,
        height: source.height,
        backgroundColor: source.backgroundColor,
        strokeColor: source.strokeColor,
        strokeWidth: source.strokeWidth,
      });
      expect(arrow).toMatchObject({
        type: "arrow",
        elbowed: true,
        startBinding: { elementId: source.id },
        endBinding: { elementId: created.id },
      });
      expect(API.getUndoStack()).toHaveLength(undoCount + 1);
      expect(h.state.selectedElementsAreBeingDragged).toBe(false);

      Keyboard.undo();
      await waitFor(() => {
        expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(
          1,
        );
      });
    },
  );

  it("places controls at the diamond vertices and supports repeated extension", async () => {
    const source = createAndSelectNode("diamond");
    const controls = screen.getAllByRole("button", {
      name: /^Add shape/,
    });
    const top = controls.find(
      (button) => button.getAttribute("aria-label") === "Add shape above",
    );
    const right = controls.find(
      (button) =>
        button.getAttribute("aria-label") === "Add shape to the right",
    );

    expect(top?.style.top).toBe("18px");
    expect(right?.style.left).toBe("219px");

    fireEvent.click(right!);
    const firstChild = API.getSelectedElement();
    fireEvent.click(
      screen.getByRole("button", { name: "Add shape to the right" }),
    );

    const secondChild = API.getSelectedElement();
    expect(secondChild.x).toBe(firstChild.x + firstChild.width + 100);
    expect(secondChild.y).toBe(firstChild.y);
    expect(
      h.elements.filter(
        (element) => element.type === "arrow" && !element.isDeleted,
      ),
    ).toHaveLength(2);
    expect(source.id).not.toBe(secondChild.id);
  });

  it("shows controls only for one unlocked rectangle or diamond in an idle interactive editor", () => {
    const source = createAndSelectNode();
    expect(screen.getAllByRole("button", { name: /^Add shape/ })).toHaveLength(
      4,
    );

    API.setAppState({ selectedElementsAreBeingDragged: true });
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();
    API.setAppState({ selectedElementsAreBeingDragged: false });

    API.setAppState({ viewModeEnabled: true });
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();
    API.setAppState({ viewModeEnabled: false });

    API.setAppState({ isRotating: true });
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();
    API.setAppState({ isRotating: false });

    API.setAppState({ resizingElement: source });
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();
    API.setAppState({ resizingElement: null });

    API.setAppState({ selectionElement: source });
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();
    API.setAppState({ selectionElement: null });

    const text = API.createElement({ type: "text", text: "label" });
    API.setElements([source, text]);
    API.setAppState({ editingTextElement: text });
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();
    API.setAppState({ editingTextElement: null });

    const secondNode = API.createElement({ type: "rectangle", x: 400, y: 60 });
    API.setElements([source, secondNode]);
    API.setSelectedElements([source, secondNode]);
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();
  });

  it("hides controls for unsupported and locked shapes", () => {
    createAndSelectNode("ellipse");
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();

    const locked = createAndSelectNode("rectangle", true);
    expect(locked.locked).toBe(true);
    expect(screen.queryByRole("button", { name: /^Add shape/ })).toBeNull();
  });

  it("focuses the created node so Enter starts its label editor", async () => {
    createAndSelectNode();
    fireEvent.click(
      screen.getByRole("button", { name: "Add shape to the right" }),
    );

    Keyboard.keyPress("Enter");
    expect(await getTextEditor()).toBeTruthy();
  });
});
