import type { KeyboardEvent } from 'react'

const FOCUSABLE =
  'input:not([disabled]):not([type=hidden]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), button[data-enter-target]'

/** Moves focus to the next (or previous) field inside `container`. */
export function focusNext(from: HTMLElement, container: HTMLElement | null, backwards = false): boolean {
  const root = container ?? document.body
  const list = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null && !el.closest('[data-enter-skip]')
  )
  const i = list.indexOf(from)
  const next = list[i + (backwards ? -1 : 1)]
  if (next) {
    next.focus()
    if (next instanceof HTMLInputElement) next.select()
    return true
  }
  return false
}

/**
 * Enter behaves like Tab in forms (common in clinic software). Not inside text areas,
 * and not when an autocomplete option is highlighted (there Enter picks the option).
 */
export function enterAsTab(e: KeyboardEvent<HTMLElement>, onLastField?: () => void): void {
  if (e.key !== 'Enter' || e.ctrlKey || e.altKey || e.metaKey) return
  const target = e.target as HTMLElement
  if (target instanceof HTMLTextAreaElement && !e.shiftKey) return
  if (target.tagName === 'BUTTON') return
  // An autocomplete already used this Enter to pick an option.
  if (e.defaultPrevented) return
  e.preventDefault()
  const moved = focusNext(target, e.currentTarget, e.shiftKey && !(target instanceof HTMLTextAreaElement))
  if (!moved) onLastField?.()
}
