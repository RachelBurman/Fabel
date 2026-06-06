/**
 * @jest-environment jsdom
 *
 * Tests for the barcode detection utility (detectBarcodeFromFile).
 * Proxy route tests live in vision-scanner.test.ts (node env).
 */

import { detectBarcodeFromFile, type BarcodeDetectorCtor } from '../barcode-scanner'

function makeFile(): File {
  return new File(['data'], 'test.jpg', { type: 'image/jpeg' })
}

const mockBitmap = { close: jest.fn() }

beforeEach(() => {
  mockBitmap.close.mockClear()
  global.createImageBitmap = jest.fn().mockResolvedValue(mockBitmap)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).BarcodeDetector
})

describe('detectBarcodeFromFile', () => {
  it('returns barcode string when BarcodeDetector finds a numeric barcode', async () => {
    const MockDetector = jest.fn().mockImplementation(() => ({
      detect: jest.fn().mockResolvedValue([{ rawValue: '5000112637922' }]),
    })) as unknown as BarcodeDetectorCtor
    const result = await detectBarcodeFromFile(makeFile(), MockDetector)
    expect(result).toBe('5000112637922')
  })

  it('non-null result routes to /api/scan-barcode — validates numeric pattern', async () => {
    const MockDetector = jest.fn().mockImplementation(() => ({
      detect: jest.fn().mockResolvedValue([{ rawValue: '5000112637922' }]),
    })) as unknown as BarcodeDetectorCtor
    const barcode = await detectBarcodeFromFile(makeFile(), MockDetector)
    expect(barcode).not.toBeNull()
    expect(barcode).toMatch(/^\d{8,14}$/)
  })

  it('returns null when BarcodeDetector finds no barcode — routes to /api/scan-ingredients', async () => {
    const MockDetector = jest.fn().mockImplementation(() => ({
      detect: jest.fn().mockResolvedValue([]),
    })) as unknown as BarcodeDetectorCtor
    const result = await detectBarcodeFromFile(makeFile(), MockDetector)
    expect(result).toBeNull()
  })

  it('returns null when BarcodeDetector is not available — routes to /api/scan-ingredients', async () => {
    // No BarcodeDetectorCls passed, window.BarcodeDetector deleted in beforeEach
    const result = await detectBarcodeFromFile(makeFile())
    expect(result).toBeNull()
  })

  it('returns null for non-numeric barcode value — routes to /api/scan-ingredients silently', async () => {
    const MockDetector = jest.fn().mockImplementation(() => ({
      detect: jest.fn().mockResolvedValue([{ rawValue: 'QR_CODE_URL_https://example.com' }]),
    })) as unknown as BarcodeDetectorCtor
    const result = await detectBarcodeFromFile(makeFile(), MockDetector)
    expect(result).toBeNull()
  })

  it('returns null when BarcodeDetector throws — falls through silently', async () => {
    const MockDetector = jest.fn().mockImplementation(() => ({
      detect: jest.fn().mockRejectedValue(new Error('DOMException: NotSupportedError')),
    })) as unknown as BarcodeDetectorCtor
    const result = await detectBarcodeFromFile(makeFile(), MockDetector)
    expect(result).toBeNull()
  })
})
