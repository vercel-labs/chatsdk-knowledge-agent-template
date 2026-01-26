export interface FileWithStatus {
  file: File
  id: string
  previewUrl: string
  status: 'uploading' | 'uploaded' | 'error'
  uploadedUrl?: string
  uploadedPathname?: string
  error?: string
}

export const FILE_UPLOAD_CONFIG = {
  maxSize: '8MB',
  types: ['image', 'application/pdf', 'text/csv'],
  acceptPattern: 'image/*,application/pdf,.csv,text/csv'
} as const

export const IMAGE_OPTIMIZATION_CONFIG = {
  storage: { maxWidth: 2048, maxHeight: 2048, quality: 80, format: 'webp' as const },
  ocr: { maxWidth: 1536, maxHeight: 1536, quality: 85, format: 'jpeg' as const },
} as const

export function getFileIcon(mimeType: string, fileName?: string): string {
  if (mimeType.startsWith('image/')) return 'i-lucide-image'
  if (mimeType === 'application/pdf') return 'i-lucide-file-text'
  if (mimeType === 'text/csv' || fileName?.endsWith('.csv')) return 'i-lucide-file-spreadsheet'
  return 'i-lucide-file'
}

export function removeRandomSuffix(filename: string): string {
  return filename.replace(/^(.+)-[a-zA-Z0-9]+(\.[^.]+)$/, '$1$2')
}
