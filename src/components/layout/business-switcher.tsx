"use client";

// src/components/layout/business-switcher.tsx
//
// Which business you are looking at, and how to change it.
//
// ── WHY IT SITS IN THE HEADER ────────────────────────────────────────
// Everything below it is scoped by it. A control that changes the
// meaning of every other screen has to be visible from every other
// screen, or people read the wrong numbers and never learn why. The
// header is the only strip present on all of them — the desktop sidebar
// is a 72px icon rail with no room for a name.
//
// It also takes the slot where the business name was already printed,
// so nothing moves: the label people already read as "whose data is
// this" simply becomes the control that answers it.
//
// ── WHY IT IS A MENU EVEN WITH ONE BUSINESS ──────────────────────────
// It used to render as a plain label until a second business existed,
// on the grounds that a control which does nothing is worse than a
// label. That stopped being true once businesses could be created:
// with one business the menu still has something to offer — the way to
// make the second — and the switcher is where someone looks for it.
//
// Hiding it until there are two would also mean the first time anyone
// sees it is the moment they are already confused about which business
// they are in.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useBusiness } from "@/hooks/use-business";

interface BusinessSwitcherProps {
  /**
   * Shown when the account has no business row yet — i.e. before
   * migration 030 has run, or for an account created before it. Without
   * it the header would go blank on exactly the accounts that already
   * work fine, which reads as breakage rather than as a pending
   * migration.
   */
  fallbackName?: string;
}

export function BusinessSwitcher({ fallbackName }: BusinessSwitcherProps) {
  const { businesses, business, loading, switchTo } = useBusiness();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. Both, because a dropdown that
  // only closes one way is a dropdown people end up fighting.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) {
    return (
      <div className="bsw">
        <style>{css}</style>
        <div className="bsw-skeleton" aria-hidden="true" />
      </div>
    );
  }

  // No business row. Keep showing the name the header showed before
  // rather than an error — the app still works, it just is not scoped
  // yet.
  if (!business) {
    return (
      <div className="bsw">
        <style>{css}</style>
        <span className="bsw-plain">{fallbackName || "Your Business"}</span>
      </div>
    );
  }

  const many = businesses.length > 1;

  return (
    <div className="bsw" ref={ref}>
      <style>{css}</style>

      <button
        type="button"
        className="bsw-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={business.name}
      >
        {business.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logo_url} alt="" className="bsw-logo" />
        )}
        <span className="bsw-name">{business.name}</span>
        <ChevronDown size={14} className={open ? "bsw-chev open" : "bsw-chev"} />
      </button>

      {open && (
        <ul className="bsw-menu" role="listbox" aria-label="Switch business">
          <li className="bsw-heading" role="presentation">
            {many ? "Switch business" : "Business"}
          </li>

          {businesses.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                role="option"
                aria-selected={b.id === business.id}
                className={b.id === business.id ? "bsw-item on" : "bsw-item"}
                onClick={() => {
                  setOpen(false);
                  if (b.id !== business.id) switchTo(b.id);
                }}
              >
                <span className="bsw-item-left">
                  {b.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo_url} alt="" className="bsw-logo" />
                  )}
                  <span className="bsw-item-name">{b.name}</span>
                </span>
                {b.id === business.id && <Check size={13} />}
              </button>
            </li>
          ))}

          <li className="bsw-sep" role="presentation" />

          <li>
            <a className="bsw-item bsw-add" href="/settings?tab=businesses">
              <Plus size={13} /> Add a business
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}

const css = `
.bsw { position: relative; min-width: 0; }

.bsw-skeleton {
  width: 120px; height: 20px;
  border-radius: 6px; background: #eef2f0;
}

/* Matches the header's old business-name span exactly, so a
   single-business account sees no visual change at all. */
.bsw-plain {
  display: block; max-width: 240px;
  font-size: 16px; font-weight: 700; color: #0c1f17;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.bsw-trigger {
  display: flex; align-items: center; gap: 5px; max-width: 260px;
  margin-left: -7px; /* keeps the name optically aligned with the plain label */
  padding: 4px 7px; border: none; border-radius: 8px;
  background: none; cursor: pointer; font-family: inherit;
  transition: background .15s;
}
.bsw-trigger:hover { background: #f1f5f3; }
.bsw-trigger:focus-visible { outline: 2px solid #10b981; outline-offset: 1px; }

.bsw-name {
  min-width: 0;
  font-size: 16px; font-weight: 700; color: #0c1f17;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.bsw-logo {
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
  object-fit: cover; border: 1px solid #e8ede9;
}

.bsw-item-left { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; }

.bsw-chev { color: #8a978f; flex-shrink: 0; transition: transform .15s; }
.bsw-chev.open { transform: rotate(180deg); }

.bsw-menu {
  position: absolute; left: -7px; top: calc(100% + 7px);
  z-index: 60; min-width: 232px; max-width: 300px;
  margin: 0; padding: 5px; list-style: none;
  background: #fff; border: 1px solid #e8ede9; border-radius: 11px;
  box-shadow: 0 12px 32px -8px rgba(12,31,23,.22);
  max-height: 320px; overflow-y: auto;
}

.bsw-heading {
  padding: 6px 9px 5px;
  font-size: 9.5px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: #9aa8a0;
}

.bsw-item {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 8px 9px; border: none; background: none;
  border-radius: 7px; cursor: pointer; font-family: inherit;
  font-size: 13px; color: #0c1f17; text-align: left; text-decoration: none;
}
.bsw-item:hover { background: #f4f7f5; }
.bsw-item:focus-visible { outline: 2px solid #10b981; outline-offset: -2px; }
.bsw-item.on { color: #059669; font-weight: 600; }
.bsw-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.bsw-sep { height: 1px; background: #eef2f0; margin: 5px 3px; }
.bsw-add { color: #5b6b63; font-size: 12.5px; justify-content: flex-start; }
`;
