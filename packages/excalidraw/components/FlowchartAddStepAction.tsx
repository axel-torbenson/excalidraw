import React, { useState } from "react";
import { Popover } from "radix-ui";

import {
  isFlowchartNodeElement,
  type LinkDirection,
} from "@excalidraw/element";

import { useApp, useExcalidrawAppState, useExcalidrawContainer } from "./App";
import { PlusIcon } from "./icons";

import "./FlowchartAddStepAction.scss";

const DIRECTIONS: readonly {
  direction: LinkDirection;
  label: string;
  symbol: string;
}[] = [
  { direction: "up", label: "Add step above", symbol: "↑" },
  { direction: "right", label: "Add step to the right", symbol: "→" },
  { direction: "down", label: "Add step below", symbol: "↓" },
  { direction: "left", label: "Add step to the left", symbol: "←" },
];

export const FlowchartAddStepAction = React.memo(() => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const { container } = useExcalidrawContainer();
  const [open, setOpen] = useState(false);
  const selectedElements = app.scene.getSelectedElements(appState);
  const selectedElement =
    selectedElements.length === 1 ? selectedElements[0] : null;
  const isSupportedShape =
    selectedElement &&
    isFlowchartNodeElement(selectedElement) &&
    (selectedElement.type === "rectangle" ||
      selectedElement.type === "diamond");

  if (
    !isSupportedShape ||
    selectedElement.locked ||
    appState.viewModeEnabled ||
    appState.activeTool.type !== "selection" ||
    appState.editingTextElement ||
    appState.newElement ||
    appState.contextMenu ||
    appState.openDialog ||
    appState.openMenu ||
    app.flowchart.isCreatingChart
  ) {
    return null;
  }

  return (
    <div className="compact-action-item flowchart-add-step">
      <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="compact-action-button flowchart-add-step__trigger"
            aria-label="Add connected step"
            aria-expanded={open}
            title="Add connected step"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen((isOpen) => !isOpen);
            }}
          >
            {PlusIcon}
          </button>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content
            className="flowchart-add-step__popover"
            side="right"
            align="center"
            sideOffset={8}
            collisionPadding={8}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div
              className="flowchart-add-step__picker"
              role="group"
              aria-label="Choose direction for new step"
            >
              {DIRECTIONS.map(({ direction, label, symbol }) => (
                <button
                  key={direction}
                  type="button"
                  className="flowchart-add-step__direction"
                  aria-label={label}
                  title={label}
                  onClick={() => {
                    app.flowchart.addNode(selectedElement, direction);
                    setOpen(false);
                  }}
                >
                  {symbol}
                </button>
              ))}
            </div>
            <Popover.Arrow
              width={12}
              height={6}
              className="flowchart-add-step__arrow"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
});