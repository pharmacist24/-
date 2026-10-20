// Placeholder until the print renderer milestone.
export function usePrinting() {
  return {
    previewSaved: (_id: number, _layoutId?: number) => undefined,
    printSaved: (_id: number, _layoutId?: number) => undefined,
    pdfSaved: (_id: number, _layoutId?: number) => undefined,
    element: null
  }
}
