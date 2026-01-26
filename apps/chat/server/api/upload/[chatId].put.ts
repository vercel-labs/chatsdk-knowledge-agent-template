import { blob } from 'hub:blob'
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { IMAGE_OPTIMIZATION_CONFIG } from '~~/shared/utils/file'
import { isOptimizableImage, optimizeImage } from '~~/server/utils/image/optimize'

interface FileData {
  buffer: Buffer
  type: string
  filename: string
}

function isAllowedType(type: string, filename: string): boolean {
  return type.startsWith('image/')
    || type === 'application/pdf'
    || type === 'text/csv'
    || filename.endsWith('.csv')
}

function generatePathname(username: string, chatId: string, filename: string): string {
  const suffix = crypto.randomUUID().slice(0, 8)
  const ext = filename.match(/(\.[^.]+)$/)?.[1] || ''
  const base = filename.replace(/\.[^.]+$/, '') || 'file'
  return `${username}/${chatId}/${base}-${suffix}${ext}`
}

async function processFile(file: FileData): Promise<FileData> {
  if (!isOptimizableImage(file.type)) return file

  try {
    const config = IMAGE_OPTIMIZATION_CONFIG.storage
    const result = await optimizeImage(file.buffer, config)
    const ext = result.mimeType.includes('/') ? result.mimeType.split('/')[1] : 'webp'
    const base = file.filename.replace(/\.[^.]+$/, '') || 'image'

    return {
      buffer: result.buffer,
      type: result.mimeType,
      filename: `${base}.${ext}`,
    }
  } catch (error) {
    console.error('Image optimization failed, using original file', { filename: file.filename, error })
    return file
  }
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { chatId } = await getValidatedRouterParams(event, z.object({ chatId: z.string() }).parse)

  const chat = await db.query.chats.findFirst({
    where: () => eq(schema.chats.id, chatId),
  })

  if (chat && chat.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have permission to upload files to this chat' })
  }

  const formData = await readMultipartFormData(event)
  const field = formData?.find(f => f.name === 'files')

  if (!field?.data || !field?.filename) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  const originalType = field.type || 'application/octet-stream'

  if (!isAllowedType(originalType, field.filename)) {
    throw createError({ statusCode: 400, statusMessage: `File type ${originalType} is not allowed` })
  }

  if (field.data.length > 8 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'File size exceeds 8MB limit' })
  }

  const processed = await processFile({
    buffer: field.data,
    type: originalType,
    filename: field.filename,
  })

  const pathname = generatePathname(user.username, chatId, processed.filename)
  const result = await blob.put(pathname, processed.buffer, { contentType: processed.type })

  return {
    pathname: result.pathname,
    url: result.url || undefined,
    contentType: processed.type,
    size: processed.buffer.length,
  }
})
