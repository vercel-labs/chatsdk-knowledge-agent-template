import sharp from 'sharp'

export interface OptimizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png' | 'original'
}

export interface OptimizeResult {
  buffer: Buffer
  mimeType: string
}

const MIME_TYPES = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
} as const

function parseBase64(input: string): { buffer: Buffer, format: string | null } {
  const match = input.match(/^data:image\/([^;]+);base64,(.+)$/)
  if (match) {
    return { buffer: Buffer.from(match[2]!, 'base64'), format: match[1]! }
  }
  return { buffer: Buffer.from(input, 'base64'), format: null }
}

function toSharpFormat(format: string): 'webp' | 'jpeg' | 'png' {
  if (format.includes('webp')) return 'webp'
  if (format.includes('png')) return 'png'
  return 'jpeg'
}

function applyCompression(pipeline: sharp.Sharp, format: 'webp' | 'jpeg' | 'png', quality: number) {
  const q = Math.max(1, Math.min(quality, 100))
  switch (format) {
    case 'webp': return pipeline.webp({ quality: q })
    case 'png': {
      const compressionLevel = Math.round(((100 - q) / 100) * 9)
      return pipeline.png({ quality: q, compressionLevel, palette: q < 90 })
    }
    default: return pipeline.jpeg({ quality: q, mozjpeg: true })
  }
}

export async function optimizeImage(
  input: Buffer | string,
  options: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const { maxWidth = 2048, maxHeight = 2048, quality = 80, format = 'original' } = options

  const { buffer: inputBuffer, format: detectedFormat } = typeof input === 'string'
    ? parseBase64(input)
    : { buffer: input, format: null }

  const metadata = await sharp(inputBuffer).metadata()
  const sourceFormat = detectedFormat || metadata.format || 'jpeg'
  const outputFormat = format === 'original' ? toSharpFormat(sourceFormat) : format

  let pipeline = sharp(inputBuffer)

  const needsResize = (metadata.width && metadata.width > maxWidth)
    || (metadata.height && metadata.height > maxHeight)

  if (needsResize) {
    pipeline = pipeline.resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
  }

  pipeline = applyCompression(pipeline, outputFormat, quality)

  return {
    buffer: await pipeline.toBuffer(),
    mimeType: MIME_TYPES[outputFormat],
  }
}

export function isOptimizableImage(mimeType: string): boolean {
  return mimeType.startsWith('image/') && !mimeType.includes('svg')
}
