import { fireEvent, screen } from "@testing-library/react";

import { CaptureUpdateAction } from "@excalidraw/element";
import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

const { h } = window;
unmountComponent();

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw handleKeyboardGlobally />);
  API.setAppState({ width: 1000, height: 1000 });
});

const selectNode = (type: "rectangle" | "diamond" = "rectangle") => {
  const node = API.createElement({
    type,
    x: 300,
    y: 200,
    width: 180,
    height: 100,
    strokeColor: "#e03131",
    backgroundColor: "#ffec99",
    strokeWidth: 2,
  });
  API.updateScene({
    elements: [node],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  API.setSelectedElements([node]);
  return node;
};

describe("contextual Add step", () => {
  it.each(["rectangle", "diamond"] as const)(
    "creates a connected %s with inherited style, selects it, and supports labeling",
    (type) => {
      const source = selectNode(type);
      fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Right" }));
      const child = h.elements.find(
        (element) => element.type === type && element.id !== source.id,
      )!;
      const arrow = h.elements.find((element) => element.type === "arrow")!;
      expect(h.elements).toHaveLength(3);
      expect(child.x).toBeGreaterThan(source.x + source.width);
      expect(child).toMatchObject({
        width: source.width,
        height: source.height,
        strokeColor: source.strokeColor,
        backgroundColor: source.backgroundColor,
        strokeWidth: source.strokeWidth,
      });
      expect(arrow).toMatchObject({
        elbowed: true,
        startBinding: { elementId: source.id },
        endBinding: { elementId: child.id },
      });
      expect(h.state.selectedElementIds).toEqual({ [child.id]: true });
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.editingTextElement?.containerId).toBe(child.id);
      expect(
        screen.queryByRole("button", { name: /Add step/ }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["Right", "Down", "Left", "Up"] as const)(
    "places the next step in the %s direction",
    (direction) => {
      const source = selectNode();
      fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: direction }));
      const child = h.elements.find(
        (element) => element.type === "rectangle" && element.id !== source.id,
      )!;
      if (direction === "Right") {
        expect(child.x).toBeGreaterThan(source.x + source.width);
      } else if (direction === "Down") {
        expect(child.y).toBeGreaterThan(source.y + source.height);
      } else if (direction === "Left") {
        expect(child.x + child.width).toBeLessThan(source.x);
      } else {
        expect(child.y + child.height).toBeLessThan(source.y);
      }
    },
  );

  it("supports one-step undo/redo", () => {
    selectNode();
    fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Down" }));
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(3);
    Keyboard.undo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
    Keyboard.redo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(3);
  });

  it("supports keyboard navigation, Escape and outside dismissal without creation", () => {
    selectNode();
    const trigger = screen.getByRole("button", { name: /Add step/ });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const right = screen.getByRole("menuitem", { name: "Right" });
    expect(right).toHaveFocus();
    fireEvent.keyDown(right, { key: "ArrowDown" });
    const down = screen.getByRole("menuitem", { name: "Down" });
    expect(down).toHaveFocus();
    fireEvent.keyDown(down, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(h.elements).toHaveLength(1);
  });

  it.each(["ellipse", "arrow", "text"] as const)(
    "does not show for %s",
    (type) => {
      const node = API.createElement({ type });
      API.setElements([node]);
      API.setSelectedElements([node]);
      expect(
        screen.queryByRole("button", { name: /Add step/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("hides for no selection, multiselection, locked shapes, view mode and other tools", () => {
    expect(
      screen.queryByRole("button", { name: /Add step/ }),
    ).not.toBeInTheDocument();
    const source = selectNode();
    const second = API.createElement({ type: "diamond" });
    API.setElements([source, second]);
    API.setSelectedElements([source, second]);
    expect(
      screen.queryByRole("button", { name: /Add step/ }),
    ).not.toBeInTheDocument();
    API.setSelectedElements([source]);
    API.setAppState({ viewModeEnabled: true });
    expect(
      screen.queryByRole("button", { name: /Add step/ }),
    ).not.toBeInTheDocument();
    API.setAppState({ viewModeEnabled: false });
    UI.clickTool("rectangle");
    expect(
      screen.queryByRole("button", { name: /Add step/ }),
    ).not.toBeInTheDocument();
    const locked = API.createElement({ type: "rectangle", locked: true });
    API.setElements([locked]);
    API.setSelectedElements([locked]);
    UI.clickTool("selection");
    expect(
      screen.queryByRole("button", { name: /Add step/ }),
    ).not.toBeInTheDocument();
  });
});
