import React from 'react'
import ReactDOM from 'react-dom/client'
import { bridge } from './bridge'

// The desktop screens talk to window.rxdesk; in the browser it is served by the bridge.
;(window as unknown as { rxdesk: typeof bridge }).rxdesk = bridge

import('./App').then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
