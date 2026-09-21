import React from "react";
import { act } from "@testing-library/react";
import { reseed } from "@excalidraw/common";

import type { LinkDirection } from "@excalidraw/element";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { render } from "./test-utils";
import { UI } from "./helpers/ui";

const { h } = window;

describe("contextual flowchart add step", () => {
  beforeEach(() => {
    localStorage.clear();
    reseed(7);
  });

  it.each([
    ["rectangle", "up"],
    ["rectangle", "right"],
    ["rectangle", "down"],
    ["rectangle", "left"],
    ["diamond", "up"],
    ["diamond", "right"],
    ["diamond", "down"],
    ["diamond", "left"],
  ] as const)(
    "creates a styled bound step for a %s in the %s direction",
    async (type, direction: LinkDirection) => {
      await render(<Excalidraw />);

      const source = UI.createElement(type, {
        x: 300,
        y: 200,
        width: 120,
        height: 80,
      });
      const sourceElement = source.get() as NonDeletedExcalidrawElement;

      act(() => {
        h.app.flowchart.addNode(sourceElement, direction);
      });

      const createdNode = h.elements.find(
        (element) =>
          element.id !== source.id &&
          element.type === source.type &&
          !element.isDeleted,
      );
      const bindingArrow = h.elements.find(
        (element) =>
          element.type === "arrow" &&
          element.endBinding?.elementId === createdNode?.id,
      );

      expect(createdNode).toMatchObject({
        type,
        width: source.width,
        height: source.height,
        strokeColor: source.strokeColor,
        backgroundColor: source.backgroundColor,
        strokeWidth: source.strokeWidth,
        roundness: source.roundness,
      });
      expect(bindingArrow).toMatchObject({
        startBinding: { elementId: source.id },
        endBinding: { elementId: createdNode?.id },
      });

      expect(createdNode).toBeDefined();
      if (!createdNode) {
        return;
      }

      expect([createdNode.x, createdNode.y]).toEqual(
        direction === "right"
          ? [source.x + source.width + 100, source.y]
          : direction === "left"
          ? [source.x - source.width - 100, source.y]
          : direction === "down"
          ? [source.x, source.y + source.height + 100]
          : [source.x, source.y - source.height - 100],
      );
    },
  );
});