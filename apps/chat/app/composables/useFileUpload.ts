interface BlobResult {
  pathname: string
  url?: string
  contentType?: string
  size: number
}

function createObjectUrl(file: File): string {
  return URL.createObjectURL(file)
}

function fileToInput(file: File): HTMLInputElement {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)

  const input = document.createElement('input')
  input.type = 'file'
  input.files = dataTransfer.files

  return input
}

export function useFileUploadWithStatus(chatId: string) {
  const files = shallowRef<FileWithStatus[]>([])
  const toast = useToast()
  const { loggedIn } = useUserSession()

  const upload = useUpload(`/api/upload/${chatId}`, { method: 'PUT' })

  function updateFileAt(id: string, update: Partial<FileWithStatus>) {
    files.value = files.value.map(f => f.id === id ? { ...f, ...update } : f)
  }

  async function uploadFiles(newFiles: File[]) {
    if (!loggedIn.value) {
      return
    }

    const filesWithStatus: FileWithStatus[] = newFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      previewUrl: createObjectUrl(file),
      status: 'uploading' as const
    }))

    files.value = [...files.value, ...filesWithStatus]

    const uploadPromises = filesWithStatus.map(async (fileWithStatus) => {
      try {
        const input = fileToInput(fileWithStatus.file)
        const response = await upload(input) as BlobResult | BlobResult[] | undefined

        if (!response) {
          throw new Error('Upload failed')
        }

        const result = Array.isArray(response) ? response[0] : response

        if (!result) {
          throw new Error('Upload failed')
        }

        updateFileAt(fileWithStatus.id, {
          status: 'uploaded',
          uploadedUrl: result.url,
          uploadedPathname: result.pathname
        })
      } catch (error) {
        const errorMessage = (error as { data?: { message?: string } }).data?.message
          || (error as Error).message
          || 'Upload failed'
        toast.add({
          title: 'Upload failed',
          description: errorMessage,
          icon: 'i-lucide-alert-circle',
          color: 'error'
        })
        updateFileAt(fileWithStatus.id, {
          status: 'error',
          error: errorMessage
        })
      }
    })

    await Promise.allSettled(uploadPromises)
  }

  const { dropzoneRef, isDragging } = useFileUpload({
    accept: FILE_UPLOAD_CONFIG.acceptPattern,
    multiple: true,
    onUpdate: uploadFiles
  })

  const isUploading = computed(() =>
    files.value.some(f => f.status === 'uploading')
  )

  const uploadedFiles = computed(() =>
    files.value
      .filter(f => f.status === 'uploaded' && f.uploadedUrl)
      .map(f => ({
        type: 'file' as const,
        mediaType: f.file.type,
        url: f.uploadedUrl!
      }))
  )

  function removeFile(id: string) {
    const file = files.value.find(f => f.id === id)
    if (!file) return

    URL.revokeObjectURL(file.previewUrl)
    files.value = files.value.filter(f => f.id !== id)

    if (file.status === 'uploaded' && file.uploadedPathname) {
      fetch(`/api/upload/${file.uploadedPathname}`, {
        method: 'DELETE'
      }).catch((error) => {
        console.error('Failed to delete file from blob:', error)
      })
    }
  }

  function clearFiles() {
    if (files.value.length === 0) return
    files.value.forEach(fileWithStatus => URL.revokeObjectURL(fileWithStatus.previewUrl))
    files.value = []
  }

  onUnmounted(() => {
    clearFiles()
  })

  return {
    dropzoneRef,
    isDragging,
    files,
    isUploading,
    uploadedFiles,
    addFiles: uploadFiles,
    removeFile,
    clearFiles
  }
}
