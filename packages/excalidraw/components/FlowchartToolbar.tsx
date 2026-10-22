import { useEffect, useRef, useState } from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getCommonBounds, type LinkDirection } from "@excalidraw/element";

import { t } from "../i18n";

import "./FlowchartToolbar.scss";

import type App from "./App";

const directions: LinkDirection[] = ["up", "right", "down", "left"];
const symbols = { up: "↑", right: "→", down: "↓", left: "←" };
const directionLabels = () => ({
  up: t("labels.addStepUp"),
  right: t("labels.addStepRight"),
  down: t("labels.addStepDown"),
  left: t("labels.addStepLeft"),
});

export const FlowchartToolbar = ({ app }: { app: App }) => {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<LinkDirection>("right");
  const lastUsedDirection = useRef<LinkDirection>("right");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const state = app.state;
  const selected = app.scene.getSelectedElements(state);
  const element = selected.length === 1 ? selected[0] : null;
  const visible =
    element &&
    (element.type === "rectangle" || element.type === "diamond") &&
    !element.locked &&
    !state.viewModeEnabled &&
    !state.editingTextElement &&
    !state.selectedElementsAreBeingDragged &&
    !state.resizingElement &&
    !state.isResizing &&
    !state.isRotating &&
    !state.newElement &&
    !state.selectionElement &&
    !state.contextMenu &&
    !state.openMenu &&
    state.activeTool.type === "selection";

  useEffect(() => {
    setOpen(false);
    return () => app.flowchart.cancelStepPreview();
  }, [app, element?.id, visible]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        app.flowchart.cancelStepPreview();
      }
    };
    app.ownerDocument.addEventListener("pointerdown", dismiss);
    return () => app.ownerDocument.removeEventListener("pointerdown", dismiss);
  }, [app, open]);

  if (!visible || !element) {
    return null;
  }

  const [x1, y1, x2, y2] = getCommonBounds([element]);
  const top = sceneCoordsToViewportCoords(
    { sceneX: (x1 + x2) / 2, sceneY: y1 },
    state,
  );
  const bottom = sceneCoordsToViewportCoords(
    { sceneX: (x1 + x2) / 2, sceneY: y2 },
    state,
  );
  const height = open ? 88 : 36;
  const left = Math.max(
    8,
    Math.min(state.width - 168, top.x - state.offsetLeft - 80),
  );
  const above = top.y - state.offsetTop - height - 12;
  const y = Math.max(
    8,
    Math.min(
      state.height - height - 8,
      above >= 8 ? above : bottom.y - state.offsetTop + 12,
    ),
  );
  const labels = directionLabels();
  const preview = (next: LinkDirection) => {
    setDirection(next);
    app.flowchart.previewStep(next);
  };

  return (
    <div
      ref={root}
      className="flowchart-toolbar"
      style={{ left, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          app.flowchart.cancelStepPreview();
          trigger.current?.focus();
        } else if (open && event.key.startsWith("Arrow")) {
          const next = event.key.slice(5).toLowerCase() as LinkDirection;
          if (directions.includes(next)) {
            event.preventDefault();
            root.current
              ?.querySelector<HTMLButtonElement>(`[data-direction="${next}"]`)
              ?.focus();
          }
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          app.flowchart.cancelStepPreview();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (open) {
            setOpen(false);
            app.flowchart.cancelStepPreview();
          } else {
            setOpen(true);
            preview(lastUsedDirection.current);
          }
        }}
      >
        + {t("labels.addStep")}
      </button>
      {open && (
        <div role="menu" aria-label={t("labels.addStepDirection")}>
          {directions.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item}
              data-direction={item}
              aria-label={labels[item]}
              title={labels[item]}
              autoFocus={item === direction}
              onFocus={() => preview(item)}
              onMouseEnter={(event) => event.currentTarget.focus()}
              onClick={() => {
                lastUsedDirection.current = item;
                setOpen(false);
                app.flowchart.commitStep(item);
              }}
            >
              {symbols[item]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
