/**
 * @jest-environment jsdom
 *
 * Tests for the barcode detection utility (detectBarcodeFromFile).
 * Proxy route and auth tests live in vision-scanner.test.ts / auth-gating.test.ts.
 */

import { detectBarcodeFromFile } from '../barcode-scanner'

const mockDecodeFromImageUrl = jest.fn()

jest.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromImageUrl: mockDecodeFromImageUrl,
  })),
}))

beforeEach(() => {
  mockDecodeFromImageUrl.mockReset()
  global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url')
  global.URL.revokeObjectURL = jest.fn()
})

const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' })

describe('detectBarcodeFromFile', () => {
  it('returns barcode string when decode succeeds and value is numeric', async () => {
    mockDecodeFromImageUrl.mockResolvedValue({ getText: () => '5000112637922' })
    const result = await detectBarcodeFromFile(file)
    expect(result).toBe('5000112637922')
  })

  it('returns null for non-numeric barcode value — routes to /api/scan-ingredients silently', async () => {
    mockDecodeFromImageUrl.mockResolvedValue({ getText: () => 'QR_CODE_URL_https://example.com' })
    const result = await detectBarcodeFromFile(file)
    expect(result).toBeNull()
  })

  it('returns null when no barcode found (decode throws) — routes to /api/scan-ingredients', async () => {
    mockDecodeFromImageUrl.mockRejectedValue(new Error('No MultiFormat Readers were able to detect the code.'))
    const result = await detectBarcodeFromFile(file)
    expect(result).toBeNull()
  })

  it('never throws on any error — always returns null', async () => {
    mockDecodeFromImageUrl.mockRejectedValue(new Error('Unexpected internal error'))
    await expect(detectBarcodeFromFile(file)).resolves.toBeNull()
  })
})
