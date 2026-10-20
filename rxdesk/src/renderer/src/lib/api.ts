import type { Api } from '@shared/api'
import type { IpcResult } from '@shared/types'

/** Error coming back from the main process; `code` maps to a friendly translated message. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
  }
}

function makeNamespace(ns: string): any {
  return new Proxy(
    {},
    {
      get(_t, fn: string) {
        return async (...args: unknown[]) => {
          const res = (await window.rxdesk.invoke(`${ns}.${fn}`, args)) as IpcResult<unknown>
          if (!res.ok) throw new ApiError(res.code, res.message)
          return res.data
        }
      }
    }
  )
}

/** Typed client: `await api.patients.search('ahmed')` */
export const api: Api = new Proxy({} as Api, {
  get(_t, ns: string) {
    return makeNamespace(ns)
  }
})
