import { CaptureUpdateAction } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { FlowchartAddStep } from "../components/FlowchartAddStep";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";

const { h } = window;

beforeEach(async () => {
  unmountComponent();
  await render(
    <Excalidraw
      handleKeyboardGlobally={true}
      renderTopLeftUI={() => <FlowchartAddStep />}
    />,
  );
  h.state.width = 1000;
  h.state.height = 1000;
});

afterEach(() => {
  unmountComponent();
});

const selectElement = (element: NonDeletedExcalidrawElement) => {
  API.setElements([element]);
  API.setSelectedElements([element]);
};

describe("flowchart add step toolbar", () => {
  it("only shows for one selected rectangle or diamond", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    selectElement(rectangle);
    expect(screen.getByRole("button", { name: "Add step" })).toBeVisible();

    const diamond = API.createElement({
      type: "diamond",
      width: 200,
      height: 100,
    });
    selectElement(diamond);
    expect(screen.getByRole("button", { name: "Add step" })).toBeVisible();

    const ellipse = API.createElement({
      type: "ellipse",
      width: 200,
      height: 100,
    });
    selectElement(ellipse);
    expect(screen.queryByRole("button", { name: "Add step" })).toBeNull();
  });

  it.each([
    ["up", "Add step up"],
    ["right", "Add step right"],
    ["down", "Add step down"],
    ["left", "Add step left"],
  ] as const)("adds a bound, same-style node %s", (_direction, label) => {
    const source = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
      strokeColor: "#123456",
      backgroundColor: "#abcdef",
      strokeWidth: 3,
      roughness: 2,
      opacity: 70,
    });
    selectElement(source);

    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    expect(screen.getByRole("menu")).toBeVisible();
    fireEvent.click(screen.getByRole("menuitem", { name: label }));

    const newNode = h.elements.find(
      (element) => element.id !== source.id && element.type === "rectangle",
    );
    const bindingArrow = h.elements.find((element) => element.type === "arrow");

    expect(newNode).toMatchObject({
      width: source.width,
      height: source.height,
      strokeColor: source.strokeColor,
      backgroundColor: source.backgroundColor,
      strokeWidth: source.strokeWidth,
      roughness: source.roughness,
      opacity: source.opacity,
    });
    expect(bindingArrow).toMatchObject({
      startBinding: { elementId: source.id },
      endBinding: { elementId: newNode?.id },
    });
    expect(h.state.selectedElementIds[newNode?.id ?? ""]).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("captures one add-step action for undo", () => {
    const source = API.createElement({ type: "diamond" });
    API.updateScene({
      elements: [source],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([source]);

    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add step right" }));
    expect(h.elements).toHaveLength(3);

    act(() => {
      Keyboard.undo();
    });
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);
    expect(h.app.scene.getNonDeletedElements()[0].id).toBe(source.id);
  });
});
