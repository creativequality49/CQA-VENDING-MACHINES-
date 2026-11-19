"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

export default function NavMenu({ children }: { children: ReactNode }) {
  function closeOnSelection(event: MouseEvent<HTMLDetailsElement>) {
    if (event.target instanceof Element && event.target.closest("a[href]")) {
      event.currentTarget.open = false;
    }
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key === "Escape" && event.currentTarget.open) {
      event.preventDefault();
      event.currentTarget.open = false;
      event.currentTarget.querySelector<HTMLElement>("summary")?.focus();
    }
  }

  return <details className="cqa-menu" onClick={closeOnSelection} onKeyDown={closeOnEscape}>{children}</details>;
}
