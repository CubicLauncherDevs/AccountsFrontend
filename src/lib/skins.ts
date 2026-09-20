export const MAX_SKIN_BYTES = 128 * 1024

/** Read dimensions before the browser/3D viewer decodes the PNG. Server validation remains authoritative. */
export async function validateSkinFile(file: File): Promise<{ width: number; height: number }> {
  if (file.size > MAX_SKIN_BYTES) throw new Error('La skin supera los 128 KiB permitidos.')
  const header = new Uint8Array(await file.slice(0, 33).arrayBuffer())
  if (
    header.length < 33 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => header[i] === value) ||
    String.fromCharCode(...header.slice(12, 16)) !== 'IHDR'
  )
    throw new Error('Elegí una imagen PNG válida.')
  const view = new DataView(header.buffer)
  const width = view.getUint32(16),
    height = view.getUint32(20)
  if (width !== 64 || ![32, 64].includes(height))
    throw new Error('La skin debe medir 64 × 64 o 64 × 32 píxeles.')
  if (header[28] !== 0 || (header[24] ?? 16) > 8)
    throw new Error('Usá un PNG no entrelazado de hasta 8 bits por canal.')
  return { width, height }
}

export function referenceSkin(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b8bac1'
  ctx.fillRect(0, 0, 32, 16)
  ctx.fillStyle = '#666971'
  ctx.fillRect(16, 16, 24, 16)
  ctx.fillStyle = '#93959e'
  ctx.fillRect(40, 16, 16, 16)
  ctx.fillRect(32, 48, 16, 16)
  ctx.fillStyle = '#3f4149'
  ctx.fillRect(0, 16, 16, 16)
  ctx.fillRect(16, 48, 16, 16)
  ctx.fillStyle = '#2e3036'
  ctx.fillRect(10, 11, 2, 1)
  ctx.fillRect(14, 11, 2, 1)
  ctx.fillStyle = '#e9e9ed'
  ctx.fillRect(20, 21, 3, 3)
  return canvas
}
