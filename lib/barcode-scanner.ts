const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
const NUMERIC_BARCODE_RE = /^\d{8,14}$/

export interface BarcodeDetectorLike {
  detect(bitmap: ImageBitmap): Promise<Array<{ rawValue: string }>>
}

export type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike

/**
 * Attempt to detect a numeric EAN/UPC barcode from a file.
 * Returns the barcode string if found, or null if unavailable/not numeric.
 */
export async function detectBarcodeFromFile(
  file: File,
  BarcodeDetectorCls?: BarcodeDetectorCtor
): Promise<string | null> {
  const Cls = BarcodeDetectorCls ?? (
    'BarcodeDetector' in window
      ? (window as Window & { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector
      : null
  )
  if (!Cls) return null

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const detector = new Cls({ formats: BARCODE_FORMATS })
    const barcodes = await detector.detect(bitmap)
    if (barcodes.length > 0 && NUMERIC_BARCODE_RE.test(barcodes[0].rawValue)) {
      return barcodes[0].rawValue
    }
    return null
  } catch {
    return null
  } finally {
    bitmap?.close()
  }
}
