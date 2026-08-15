export const editorAudioFileAccept = 'audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm'

const audioMimeByExtension:Record<string, string> = {
    mp3:'audio/mpeg',
    wav:'audio/wav',
    ogg:'audio/ogg',
    oga:'audio/ogg',
    m4a:'audio/mp4',
    aac:'audio/aac',
    flac:'audio/flac',
    webm:'audio/webm',
}

type AudioFileMetadata = Pick<File, 'name' | 'size' | 'type'>

function fileExtension(name:string) {
    return name.split('.').at(-1)?.toLowerCase() ?? ''
}

export function resolveEditorAudioMime(file:Pick<AudioFileMetadata, 'name' | 'type'>) {
    return audioMimeByExtension[fileExtension(file.name)]
        ?? (file.type.startsWith('audio/') ? file.type : '')
}

export function editorAudioFileError(file:AudioFileMetadata) {
    if (file.size <= 0) return 'Audio file is empty.'
    if (!resolveEditorAudioMime(file)) {
        return 'Choose an MP3, WAV, OGG, M4A, AAC, FLAC, or WebM audio file.'
    }
}

export function isEmbeddedEditorAudioSource(source:string) {
    return /^data:audio\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(source)
}

export function formatAudioFileSize(bytes:number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function normalizeEditorAudioDataUrl(dataUrl:string, file:Pick<AudioFileMetadata, 'name' | 'type'>) {
    const separator = dataUrl.indexOf(',')
    if (separator < 0 || !dataUrl.slice(0, separator).includes(';base64')) {
        throw new Error('Audio file could not be encoded.')
    }
    const mime = resolveEditorAudioMime(file)
    if (!mime) throw new Error('Audio format is not supported.')
    return `data:${mime};base64,${dataUrl.slice(separator + 1)}`
}

export function readEditorAudioFile(file:File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.addEventListener('load', () => {
            try {
                if (typeof reader.result !== 'string') throw new Error('Audio file could not be read.')
                resolve(normalizeEditorAudioDataUrl(reader.result, file))
            } catch (error) {
                reject(error)
            }
        }, { once:true })
        reader.addEventListener('error', () => reject(new Error('Audio file could not be read.')), { once:true })
        reader.addEventListener('abort', () => reject(new Error('Audio file selection was cancelled.')), { once:true })
        reader.readAsDataURL(file)
    })
}
