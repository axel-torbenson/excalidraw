import { reseed } from "@excalidraw/common";
import { isElbowArrow } from "@excalidraw/element";

import { Excalidraw } from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  fireEvent,
  render,
  screen,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

import type {
  ExcalidrawFlowchartNodeElement,
  NonDeletedExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { createUndoAction } from "../actions/actionHistory";

unmountComponent();

const { h } = window;

const setup = (
  type: "rectangle" | "diamond" | "ellipse" = "rectangle",
  withSecondElement = false,
) => {
  const start = API.createElement({
    type,
    x: 100,
    y: 100,
    width: 160,
    height: 80,
    strokeColor: "#cc2244",
    backgroundColor: "#ffeecc",
  }) as ExcalidrawFlowchartNodeElement;
  const second = withSecondElement
    ? API.createElement({ type: "rectangle", x: 400, y: 100 })
    : null;
  API.setElements([start, ...(second ? [second] : [])]);
  API.setSelectedElements(
    (second ? [start, second] : [start]) as NonDeletedExcalidrawElement[],
  );
  return { start, second };
};

const addStepButton = () => screen.getByRole("button", { name: /Add step/ });

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 800;
});

describe("flowchart add-step toolbar", () => {
  it.each(["up", "right", "down", "left"] as const)(
    "creates and selects a connected node %s",
    (direction) => {
      const { start } = setup();

      expect(addStepButton()).toBeTruthy();
      fireEvent.click(addStepButton());
      fireEvent.click(
        screen.getByRole("button", { name: `Add step ${direction}` }),
      );

      const node = h.elements.find(
        (element) => element.id !== start.id && element.type === "rectangle",
      ) as ExcalidrawFlowchartNodeElement;
      const arrow = h.elements.find(isElbowArrow);

      expect(node).toBeTruthy();
      expect(node.width).toBe(start.width);
      expect(node.height).toBe(start.height);
      expect(node.strokeColor).toBe(start.strokeColor);
      expect(arrow?.startBinding?.elementId).toBe(start.id);
      expect(arrow?.endBinding?.elementId).toBe(node.id);
      expect(h.state.selectedElementIds[node.id]).toBe(true);
      expect(API.getUndoStack()).toHaveLength(1);

      if (direction === "right") {
        expect(node.x).toBeGreaterThan(start.x);
      } else if (direction === "left") {
        expect(node.x).toBeLessThan(start.x);
      } else if (direction === "down") {
        expect(node.y).toBeGreaterThan(start.y);
      } else {
        expect(node.y).toBeLessThan(start.y);
      }
    },
  );

  it("is available for diamonds and not for ellipses or multiple selections", () => {
    const { start: diamond } = setup("diamond");
    expect(addStepButton()).toBeTruthy();
    fireEvent.click(addStepButton());
    fireEvent.click(screen.getByRole("button", { name: "Add step right" }));
    const diamonds = h.elements.filter((element) => element.type === "diamond");
    const diamondArrow = h.elements.find(isElbowArrow);
    expect(diamonds).toHaveLength(2);
    expect(diamondArrow?.startBinding?.elementId).toBe(diamond.id);
    expect(diamondArrow?.endBinding?.elementId).toBe(
      diamonds.find((element) => element.id !== diamond.id)?.id,
    );

    const { start: ellipse } = setup("ellipse");
    expect(ellipse.type).toBe("ellipse");
    expect(screen.queryByRole("button", { name: /Add step/ })).toBeNull();

    setup("rectangle", true);
    expect(screen.queryByRole("button", { name: /Add step/ })).toBeNull();
    expect(diamond.type).toBe("diamond");
  });

  it("opens the picker and Escape closes without creating a node", () => {
    const { start } = setup();
    fireEvent.click(addStepButton());

    expect(
      screen.getByRole("group", {
        name: "Choose a direction for the next flowchart step",
      }),
    ).toBeTruthy();
    expect(h.elements).toHaveLength(1);

    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "Escape",
    });

    expect(
      screen.queryByRole("group", {
        name: "Choose a direction for the next flowchart step",
      }),
    ).toBeNull();
    expect(h.elements).toHaveLength(1);
    expect(h.state.selectedElementIds[start.id]).toBe(true);
  });

  it("supports arrow-key direction selection and Enter confirmation", () => {
    const { start } = setup();
    fireEvent.click(addStepButton());
    const rightButton = screen.getByRole("button", {
      name: "Add step right",
    });
    fireEvent.keyDown(rightButton, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Enter" });

    const node = h.elements.find(
      (element) => element.id !== start.id && element.type === "rectangle",
    );
    expect(node?.y).toBeGreaterThan(start.y);
  });

  it("hides while an element is being dragged", () => {
    const { start } = setup();
    expect(addStepButton()).toBeTruthy();
    API.setAppState({ selectedElementsAreBeingDragged: true });
    expect(screen.queryByRole("button", { name: /Add step/ })).toBeNull();
    API.setAppState({ selectedElementsAreBeingDragged: false });
    expect(API.getSelectedElement().id).toBe(start.id);
  });

  it("hides while resizing or editing text", () => {
    const { start } = setup();
    expect(addStepButton()).toBeTruthy();

    API.setAppState({
      resizingElement: start as NonDeletedExcalidrawElement,
    });
    expect(screen.queryByRole("button", { name: /Add step/ })).toBeNull();

    API.setAppState({ resizingElement: null });
    API.setAppState({
      editingTextElement: start as unknown as ExcalidrawTextElement,
    });
    expect(screen.queryByRole("button", { name: /Add step/ })).toBeNull();
  });

  it("hides in view mode", () => {
    setup();
    expect(addStepButton()).toBeTruthy();
    API.setAppState({ viewModeEnabled: true });
    expect(screen.queryByRole("button", { name: /Add step/ })).toBeNull();
  });

  it("undoes the new node and its arrow in one step", () => {
    setup();
    fireEvent.click(addStepButton());
    fireEvent.click(screen.getByRole("button", { name: "Add step right" }));
    expect(API.getUndoStack()).toHaveLength(1);

    API.executeAction(createUndoAction(h.history));

    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(0);
  });
});
