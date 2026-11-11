// Test-only helper (not imported by production code).
// Builds a tiny but structurally valid Ogg Opus byte string with a known
// duration, so duration parsing can be tested without real audio.

export function buildOggOpus(seconds: number, opts?: { preSkip?: number; unknownGranule?: boolean; padBytes?: number }): Uint8Array {
  const preSkip = opts?.preSkip ?? 312
  const page = (granuleLo: number, granuleHi: number, payload: number[]): number[] => {
    const h = [0x4f, 0x67, 0x67, 0x53, 0, 0]
    for (let i = 0; i < 4; i++) h.push((granuleLo >>> (8 * i)) & 0xff)
    for (let i = 0; i < 4; i++) h.push((granuleHi >>> (8 * i)) & 0xff)
    h.push(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0) // serial, seq, crc
    h.push(1, payload.length) // 1 segment
    return h.concat(payload)
  }
  const head = [...'OpusHead'].map((c) => c.charCodeAt(0)).concat([1, 1, preSkip & 0xff, (preSkip >> 8) & 0xff, 0x80, 0xbb, 0, 0, 0, 0, 0])
  const first = page(0, 0, head)
  const total = Math.round(seconds * 48000) + preSkip
  const lo = opts?.unknownGranule ? 0xffffffff : total % 4294967296
  const hi = opts?.unknownGranule ? 0xffffffff : Math.floor(total / 4294967296)
  const pad = new Array(opts?.padBytes ?? 40).fill(7)
  const last = page(lo, hi, pad)
  return Uint8Array.from(first.concat(last))
}
