import { File as NodeFile } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { MAX_SKIN_BYTES, validateSkinFile } from '../skins'

function file(width: number, height: number, interlace = 0) {
  const header = new Uint8Array(33)
  header.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
  header.set([73, 72, 68, 82], 12)
  const view = new DataView(header.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  header[24] = 8
  header[28] = interlace
  return new NodeFile([header], 'skin.png') as unknown as File
}
describe('skin preflight validation', () => {
  it('accepts the two supported dimensions', async () => {
    expect(await validateSkinFile(file(64, 64))).toEqual({ width: 64, height: 64 })
    expect(await validateSkinFile(file(64, 32))).toEqual({ width: 64, height: 32 })
  })
  it('rejects invalid dimensions and interlaced files before image decoding', async () => {
    await expect(validateSkinFile(file(8192, 8192))).rejects.toThrow('64 × 64')
    await expect(validateSkinFile(file(64, 64, 1))).rejects.toThrow('entrelazado')
  })
  it('rejects huge and non-PNG files', async () => {
    await expect(
      validateSkinFile(
        new NodeFile([new Uint8Array(MAX_SKIN_BYTES + 1)], 'x.png') as unknown as File,
      ),
    ).rejects.toThrow('128 KiB')
    await expect(
      validateSkinFile(new NodeFile(['not a png'], 'x.png') as unknown as File),
    ).rejects.toThrow('PNG válida')
  })
})
