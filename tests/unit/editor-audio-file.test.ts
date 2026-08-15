import { describe, expect, it } from 'vitest'
import {
    editorAudioFileError,
    formatAudioFileSize,
    isEmbeddedEditorAudioSource,
    normalizeEditorAudioDataUrl,
    resolveEditorAudioMime,
} from '../../app/logic/editorAudioFile'

describe('editor local audio files', () => {
    it('recognizes common charting audio formats even when the browser omits MIME metadata', () => {
        expect(resolveEditorAudioMime({ name:'song.mp3', type:'' })).toBe('audio/mpeg')
        expect(resolveEditorAudioMime({ name:'song.m4a', type:'video/mp4' })).toBe('audio/mp4')
        expect(resolveEditorAudioMime({ name:'song.custom', type:'audio/x-custom' })).toBe('audio/x-custom')
        expect(resolveEditorAudioMime({ name:'song.txt', type:'text/plain' })).toBe('')
    })

    it('rejects empty and unsupported files before replacing the active source', () => {
        expect(editorAudioFileError({ name:'empty.mp3', type:'audio/mpeg', size:0 })).toBe('Audio file is empty.')
        expect(editorAudioFileError({ name:'notes.txt', type:'text/plain', size:12 })).toContain('Choose an MP3')
        expect(editorAudioFileError({ name:'song.ogg', type:'', size:12 })).toBeUndefined()
    })

    it('normalizes local data URLs into portable embedded audio sources', () => {
        const encoded = normalizeEditorAudioDataUrl(
            'data:application/octet-stream;base64,SUQz',
            { name:'track.mp3', type:'' },
        )

        expect(encoded).toBe('data:audio/mpeg;base64,SUQz')
        expect(isEmbeddedEditorAudioSource(encoded)).toBe(true)
        expect(isEmbeddedEditorAudioSource('/assets/song/track.mp3')).toBe(false)
    })

    it('formats selected file sizes for the editor status row', () => {
        expect(formatAudioFileSize(512)).toBe('512 B')
        expect(formatAudioFileSize(1536)).toBe('1.5 KB')
        expect(formatAudioFileSize(5 * 1024 ** 2)).toBe('5.0 MB')
    })
})
