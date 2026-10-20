import { useEffect, useRef, useState } from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import type { LinkDirection } from "@excalidraw/element";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import "./FlowchartAddStep.scss";

import type App from "./App";
import type { AppState } from "../types";

export const canAddFlowchartStep = (
  selected: readonly NonDeletedExcalidrawElement[],
  state: AppState,
) =>
  selected.length === 1 &&
  (selected[0].type === "rectangle" || selected[0].type === "diamond") &&
  !selected[0].locked &&
  !selected[0].groupIds.length &&
  state.activeTool.type === "selection" &&
  !state.viewModeEnabled &&
  !state.zenModeEnabled &&
  !state.isLoading &&
  !state.editingTextElement &&
  !state.newElement &&
  !state.selectedElementsAreBeingDragged &&
  !state.isResizing &&
  !state.isRotating &&
  !state.openDialog &&
  !state.contextMenu;

const directions: { direction: LinkDirection; icon: string }[] = [
  { direction: "right", icon: "→" },
  { direction: "down", icon: "↓" },
  { direction: "left", icon: "←" },
  { direction: "up", icon: "↑" },
];

export const FlowchartAddStep = ({
  app,
  node,
}: {
  app: App;
  node: NonDeletedExcalidrawElement;
}) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choices = useRef<(HTMLButtonElement | null)[]>([]);
  const state = app.state;
  const [x1, , x2, y2] = getCommonBounds([node]);
  const position = sceneCoordsToViewportCoords(
    { sceneX: (x1 + x2) / 2, sceneY: y2 },
    state,
  );
  const x = position.x - state.offsetLeft;
  const y = position.y - state.offsetTop;
  const top = Math.max(12, Math.min(state.height - 52, y + 18));

  useEffect(() => {
    if (!open) {
      return;
    }
    choices.current[0]?.focus();
    const ownerDocument = root.current!.ownerDocument;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!event.composedPath().includes(root.current!)) {
        setOpen(false);
      }
    };
    ownerDocument.addEventListener("pointerdown", closeOnOutsidePress);
    return () =>
      ownerDocument.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  // Do not pin an action to the viewport for a shape that is off-screen.
  if (x < 0 || x > state.width || y < 0 || y > state.height) {
    return null;
  }

  return (
    <div
      ref={root}
      className="flowchart-add-step"
      style={{
        left: Math.max(100, Math.min(state.width - 100, x)),
        top,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={trigger}
        className="flowchart-add-step__trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span aria-hidden="true">＋</span> {t("flowchart.addStep")}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          className="flowchart-add-step__picker"
          style={
            top > state.height - 220
              ? { bottom: "calc(100% + 6px)" }
              : { top: "calc(100% + 6px)" }
          }
        >
          <div className="flowchart-add-step__title">
            {t("flowchart.connectNext")}
          </div>
          <div
            role="menu"
            aria-label={t("flowchart.direction")}
            onKeyDown={(event) => {
              const index = choices.current.indexOf(
                event.target as HTMLButtonElement,
              );
              const delta =
                event.key === "ArrowDown" || event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowUp" || event.key === "ArrowLeft"
                  ? -1
                  : 0;
              if (delta || event.key === "Home" || event.key === "End") {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                    ? directions.length - 1
                    : (index + delta + directions.length) % directions.length;
                choices.current[next]?.focus();
              }
            }}
          >
            {directions.map(({ direction, icon }, index) => (
              <button
                key={direction}
                ref={(element) => {
                  choices.current[index] = element;
                }}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  app.flowchart.addStep(direction);
                }}
              >
                <span aria-hidden="true">{icon}</span>{" "}
                {t(`flowchart.${direction}`)}
              </button>
            ))}
          </div>
          <div className="flowchart-add-step__hint">
            {t("flowchart.labelHint")}
          </div>
        </div>
      )}
    </div>
  );
};
