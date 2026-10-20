import { useEffect, useState } from 'react'
import { api } from './lib/api'

export default function App() {
  const [info, setInfo] = useState<string>('…')
  useEffect(() => {
    Promise.all([api.app.info(), api.drugs.list(), api.layouts.list()])
      .then(([i, d, l]) => setInfo(`RxDesk ${i.version} — DB: ${i.dbPath} — drugs: ${d.length}, layouts: ${l.length}`))
      .catch((e) => setInfo('Error: ' + e.message))
  }, [])
  return <div id="status" style={{ fontFamily: 'sans-serif', padding: 24 }}>{info}</div>
}
