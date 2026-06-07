import { useMutation } from '@tanstack/react-query'

export type ScanBarcodeInput = {
  barcode: string
  userId?: string | null
}

export type ScanResult = {
  ingredients?: string[]
}

async function scanBarcode(input: ScanBarcodeInput): Promise<ScanResult> {
  const res = await fetch('/api/scan-barcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: input.barcode, ...(input.userId ? { userId: input.userId } : {}) }),
  })
  if (!res.ok) return {}
  return res.json() as Promise<ScanResult>
}

export function useScanBarcode() {
  return useMutation({ mutationFn: scanBarcode })
}
