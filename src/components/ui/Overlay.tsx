"use client";
/**
 * The one dialog component (Phase 4 dialog contract). Every popup in the app is a <Dialog>:
 *  - a visible ✕ (aria-label "Close");
 *  - Esc closes the topmost dialog;
 *  - a click outside closes it, except `confirm` dialogs (and nothing else may opt out);
 *  - Tab / Shift+Tab stay inside it; focus moves in on open and back to the opener on close;
 *  - the panel carries role="dialog" (role="menu" for `menu`), aria-labelledby and data-dialog={id}.
 * Register new ids in DIALOG_IDS (dialogIds.ts); e2e/dialogs.spec.ts must then get an opener
 * (typecheck enforces it).
 * Nothing outside this file may use role="dialog", aria-modal or a "fixed inset-0" backdrop
 * (lint + tests/dialogs.test.ts).
 */
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { DIALOG_IDS, type DialogId } from "./dialogIds";
export { DIALOG_IDS, type DialogId };

/** modal: centred with a backdrop · confirm: modal that ignores outside clicks · popover/menu: anchored panel, no backdrop */
export type DialogKind = "modal" | "confirm" | "popover" | "menu";

interface Entry {
  id: DialogId;
  kind: DialogKind;
  panel: RefObject<HTMLElement | null>;
  ignore?: RefObject<HTMLElement | null>;
  close: () => void;
}

const stack: Entry[] = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("inert") && el.getClientRects().length > 0);
}

function onKeyDown(e: KeyboardEvent) {
  const top = stack.at(-1);
  const panel = top?.panel.current;
  if (!top || !panel) return;
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    top.close();
    return;
  }
  if (e.key !== "Tab") return;
  const els = focusables(panel);
  if (!els.length) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = els[0]!;
  const last = els.at(-1)!;
  const active = document.activeElement as HTMLElement | null;
  const inside = !!active && panel.contains(active);
  if (!inside) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function onPointerDown(e: PointerEvent) {
  const top = stack.at(-1);
  const panel = top?.panel.current;
  if (!top || !panel || top.kind === "confirm") return;
  const t = e.target as Node | null;
  if (!t || panel.contains(t) || top.ignore?.current?.contains(t)) return;
  top.close();
}

/** a click on a confirmation's backdrop does nothing — not even take focus out of it */
function onMouseDown(e: MouseEvent) {
  const top = stack.at(-1);
  const panel = top?.panel.current;
  if (top?.kind === "confirm" && panel && !panel.contains(e.target as Node | null)) e.preventDefault();
}

function push(entry: Entry) {
  if (!stack.length) {
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("mousedown", onMouseDown, true);
  }
  stack.push(entry);
  syncModalFlag();
}
/** <html data-modal> while a modal or confirm dialog is open (toasts step aside: V-TOASTSTACK) */
function syncModalFlag() {
  const modal = stack.some((e) => e.kind === "modal" || e.kind === "confirm");
  if (modal) document.documentElement.dataset.modal = "";
  else delete document.documentElement.dataset.modal;
}
function pop(entry: Entry) {
  const i = stack.indexOf(entry);
  if (i >= 0) stack.splice(i, 1);
  syncModalFlag();
  if (!stack.length) {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("mousedown", onMouseDown, true);
  }
}

export interface DialogProps {
  id: DialogId;
  kind: DialogKind;
  /** heading text (also the accessible name) */
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** panel classes (size, position for popovers/menus) */
  className?: string;
  /** modal/confirm only: backdrop layout classes (default: centred) */
  backdropClassName?: string;
  /** element to focus on open (default: the first focusable control after the ✕) */
  initialFocus?: RefObject<HTMLElement | null>;
  /** popover/menu: clicks inside this element (e.g. the opener button) don't count as outside */
  ignoreOutside?: RefObject<HTMLElement | null>;
  /** visually hide the heading (it still names the dialog) */
  hideTitle?: boolean;
  /** extra props for the panel (data-testid, aria-live…) */
  panelProps?: Record<string, string | undefined>;
}

export function Dialog({ id, kind, title, onClose, children, className, backdropClassName, initialFocus, ignoreOutside, hideTitle, panelProps }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const entry: Entry = { id, kind, panel, ignore: ignoreOutside, close: () => closeRef.current() };
    push(entry);
    const p = panel.current;
    if (p && !p.contains(document.activeElement)) {
      const target = initialFocus?.current ?? focusables(p).find((el) => el.dataset.dialogClose === undefined) ?? focusables(p)[0] ?? p;
      target.focus({ preventScroll: true });
    }
    return () => {
      pop(entry);
      // give focus back to whatever opened the dialog (if it is still there and nothing else took it)
      const active = document.activeElement;
      if (opener && opener !== document.body && opener.isConnected && (!active || active === document.body || p?.contains(active))) opener.focus({ preventScroll: true });
    };
    // mount/unmount only: the entry reads onClose through a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const body = (
    <div
      ref={panel}
      role={kind === "menu" ? "menu" : "dialog"}
      aria-modal={kind === "modal" || kind === "confirm" ? true : undefined}
      aria-labelledby={titleId}
      data-dialog={id}
      data-dialog-kind={kind}
      tabIndex={-1}
      className={`outline-none ${className ?? ""}`}
      {...panelProps}
    >
      <div className={`flex items-start justify-between gap-2 ${hideTitle ? "absolute top-1 right-1" : "mb-2"}`}>
        <h2 id={titleId} className={hideTitle ? "sr-only" : "text-base font-semibold"}>
          {title}
        </h2>
        <button
          type="button"
          onClick={() => closeRef.current()}
          aria-label="Close"
          data-dialog-close=""
          className="-mt-1 -mr-1 shrink-0 rounded px-2 py-0.5 text-lg leading-none text-ink-3 hover:bg-subtle hover:text-ink-2 focus-visible:ring-2 focus-visible:ring-cyan-600"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );

  if (kind === "modal" || kind === "confirm") {
    return <div className={`fixed inset-0 z-40 flex bg-slate-900/30 p-4 ${backdropClassName ?? "items-center justify-center"}`}>{body}</div>;
  }
  return body;
}
