import { Component, type ReactNode } from 'react'

/**
 * Last line of defence: if a screen fails while drawing, show what happened (and log it) instead of a white
 * window. The text is bilingual because the translations may not be available at this point.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    window.rxdesk?.invoke('app.logError', [`Screen error: ${error?.stack ?? error}\n${info?.componentStack ?? ''}`]).catch(() => undefined)
    window.rxdesk?.invoke('app.rendered', []).catch(() => undefined)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 40, fontFamily: 'Cairo, Segoe UI, sans-serif', maxWidth: 760, margin: '40px auto', background: '#fff', borderRadius: 12, border: '1px solid #e9ecef' }}>
        <h2 style={{ margin: '0 0 8px' }} dir="rtl">حدث خطأ في هذه الشاشة. بياناتك محفوظة.</h2>
        <h3 style={{ margin: '0 0 16px', fontWeight: 500 }}>Something went wrong on this screen. Your data is safe.</h3>
        <pre dir="ltr" style={{ whiteSpace: 'pre-wrap', background: '#f8f9fa', padding: 12, borderRadius: 8, fontSize: 12, maxHeight: 240, overflow: 'auto' }}>
          {String(this.state.error?.stack ?? this.state.error)}
        </pre>
        <button style={{ padding: '10px 18px', fontSize: 16, borderRadius: 8, border: 0, background: '#0c8c69', color: '#fff', cursor: 'pointer' }} onClick={() => window.location.reload()}>
          إعادة التحميل / Reload
        </button>
      </div>
    )
  }
}
