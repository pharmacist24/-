import { useCallback, useRef, useState } from 'react'

/**
 * Undo/redo history.
 * - apply(next, mergeKey?): normal edit; edits with the same mergeKey within 1 s become one undo step
 *   (so typing in a box is undone in one go).
 * - begin() / preview(next) / commit(): for drags, many intermediate states but one undo step.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<{ past: T[]; present: T; future: T[] }>({ past: [], present: initial, future: [] })
  const dragStart = useRef<T | null>(null)
  const lastMerge = useRef<{ key: string; at: number } | null>(null)

  const apply = useCallback((next: T, mergeKey?: string) => {
    setState((s) => {
      const now = Date.now()
      const merge = mergeKey && lastMerge.current && lastMerge.current.key === mergeKey && now - lastMerge.current.at < 1000
      lastMerge.current = mergeKey ? { key: mergeKey, at: now } : null
      if (merge) return { ...s, present: next, future: [] }
      return { past: [...s.past.slice(-99), s.present], present: next, future: [] }
    })
  }, [])

  const begin = useCallback(() => {
    setState((s) => {
      dragStart.current = s.present
      return s
    })
  }, [])

  const preview = useCallback((next: T) => {
    setState((s) => ({ ...s, present: next }))
  }, [])

  const commit = useCallback(() => {
    setState((s) => {
      const start = dragStart.current
      dragStart.current = null
      lastMerge.current = null
      if (!start || start === s.present) return s
      return { past: [...s.past.slice(-99), start], present: s.present, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s))
    lastMerge.current = null
  }, [])

  const redo = useCallback(() => {
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s))
    lastMerge.current = null
  }, [])

  const reset = useCallback((value: T) => {
    setState({ past: [], present: value, future: [] })
    lastMerge.current = null
  }, [])

  return {
    present: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    apply,
    begin,
    preview,
    commit,
    undo,
    redo,
    reset
  }
}
