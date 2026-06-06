import { BrowserMultiFormatReader } from '@zxing/browser'

export async function detectBarcodeFromFile(file: File): Promise<string | null> {
  try {
    const reader = new BrowserMultiFormatReader()
    const imageUrl = URL.createObjectURL(file)

    try {
      const result = await reader.decodeFromImageUrl(imageUrl)
      const value = result.getText()

      // Only accept numeric EAN/UPC barcodes
      if (/^\d{8,14}$/.test(value)) {
        return value
      }
      return null
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  } catch {
    // No barcode found or decode failed — return null to fall through to Vision
    return null
  }
}
