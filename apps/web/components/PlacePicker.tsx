"use client";

/**
 * PlacePicker — the onboarding birth-place combobox (owner request:
 * searchable place selection). The user types, candidates load below
 * (name + admin1 + country + timezone), and an explicit pick locks the
 * coordinates — the form never silently adopts a first hit.
 *
 * ARIA 1.2 combobox pattern: input role="combobox" controlling a
 * role="listbox" of role="option" rows; aria-activedescendant tracks the
 * option under the keyboard cursor. Styling stays on the locked tokens:
 * hairline border, no radius, no shadow, 44px targets, mono micro-label
 * meta.
 *
 * All behavior below the render seam (title building, dedupe, keyboard
 * state, pick transitions, error copy) lives in lib/places.ts — tested
 * in lib/places.test.ts.
 */
import { useRef, useState } from "react";
import { fontMono } from "@/app/fonts";
import {
  candidateTitle,
  candidateZone,
  nextActiveIndex,
  type MoveKey,
  type PlaceCandidate,
  type PickedPlace,
} from "@/lib/places";

const LISTBOX_ID = "birth-place-listbox";
const STATUS_ID = "birth-place-status";

export function PlacePicker({
  query,
  onQueryChange,
  candidates,
  loading,
  error,
  picked,
  onPick,
  required,
}: {
  /** Current input value (parent-owned: it is the stored place label). */
  query: string;
  onQueryChange: (query: string) => void;
  /** Typeahead candidates for the current query (may be empty). */
  candidates: PlaceCandidate[];
  loading: boolean;
  /** Actionable geocode failure copy — rendered, never swallowed. */
  error: string | null;
  /** The locked place from an explicit pick (or edit-mode prefill). */
  picked: PickedPlace | null;
  onPick: (candidate: PlaceCandidate) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Options pick on mousedown: the input keeps focus (no blur flash
  // between mousedown and click), so the list stays open until the pick.
  const suppressBlur = useRef(false);

  const listOpen = open && candidates.length > 0;

  function pick(candidate: PlaceCandidate) {
    onPick(candidate);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const count = candidates.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (count === 0) return;
      const key: MoveKey = e.key;
      setOpen(true);
      setActive((current) => nextActiveIndex(key, current, count));
      return;
    }
    if (e.key === "Home" && listOpen) {
      e.preventDefault();
      setActive(nextActiveIndex("Home", active, count));
      return;
    }
    if (e.key === "End" && listOpen) {
      e.preventDefault();
      setActive(nextActiveIndex("End", active, count));
      return;
    }
    if (e.key === "Enter" && listOpen && active >= 0) {
      // Pick, don't submit the form.
      e.preventDefault();
      pick(candidates[active]);
      return;
    }
    if (e.key === "Escape" && listOpen) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="ui-input-field">
      <label
        htmlFor="pl"
        className={`ui-input-label type-micro-label t-11 ${fontMono.className}`}
      >
        Birth place
      </label>
      <input
        id="pl"
        data-testid="birth-place-input"
        className={`ui-input ui-focusable type-prose ${fontMono.className}`}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={listOpen && active >= 0 ? `birth-place-option-${active}` : undefined}
        aria-autocomplete="list"
        aria-describedby={error || loading || picked ? STATUS_ID : undefined}
        type="text"
        placeholder="Start typing a city — e.g. Pune"
        value={query}
        required={required}
        autoComplete="off"
        onChange={(e) => {
          onQueryChange(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => {
          if (candidates.length > 0) setOpen(true);
        }}
        onBlur={() => {
          // An option mousedown is mid-pick, not an exit.
          if (suppressBlur.current) return;
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={handleKeyDown}
      />

      {listOpen && (
        <ul
          id={LISTBOX_ID}
          role="listbox"
          aria-label="Birth place suggestions"
          data-testid="birth-place-listbox"
          className="ui-place-listbox"
        >
          {candidates.map((candidate, i) => (
            <li
              key={`${candidateTitle(candidate)}-${candidate.lat}-${candidate.lon}`}
              id={`birth-place-option-${i}`}
              role="option"
              aria-selected={i === active}
              data-testid="birth-place-option"
              className="ui-place-option"
              onMouseDown={() => {
                suppressBlur.current = true;
              }}
              onMouseUp={() => {
                suppressBlur.current = false;
              }}
              onClick={() => pick(candidate)}
            >
              <span className="ui-place-option-title type-prose t-15">
                {candidateTitle(candidate)}
              </span>
              {candidateZone(candidate) && (
                <span
                  className={`ui-place-option-meta type-micro-label t-11 ${fontMono.className}`}
                >
                  {candidateZone(candidate)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div id={STATUS_ID} data-testid="birth-place-status">
        {loading && (
          <p
            className={`type-mono t-11 ${fontMono.className}`}
            style={{ color: "var(--ink-tertiary)", margin: "calc(-1 * var(--space-3)) 0 0" }}
          >
            Resolving…
          </p>
        )}
        {!loading && error && (
          <p
            className="form-error type-prose t-15"
            role="alert"
            data-testid="birth-place-error"
            style={{ marginTop: "var(--space-2)" }}
          >
            {error}
          </p>
        )}
        {!loading && !error && picked && (
          <p
            data-testid="birth-place-picked"
            className={`type-mono t-11 ${fontMono.className}`}
            style={{ color: "var(--ink-tertiary)", margin: "calc(-1 * var(--space-3)) 0 0" }}
          >
            {picked.resolvedName} ({picked.lat.toFixed(2)}°, {picked.lon.toFixed(2)}°)
          </p>
        )}
      </div>
    </div>
  );
}
