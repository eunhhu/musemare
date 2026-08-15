import type { ButtonHTMLAttributes, SVGProps } from 'react'

export type EditorIconName =
    | 'new-file'
    | 'open'
    | 'export'
    | 'skip-back'
    | 'skip-forward'
    | 'play'
    | 'pause'
    | 'replay'
    | 'loading'
    | 'target'
    | 'audio-file'
    | 'close'
    | 'return-edit'
    | 'align'
    | 'delete'
    | 'add-object'
    | 'add-note'
    | 'add-event'

type EditorIconProps = SVGProps<SVGSVGElement> & {
    name:EditorIconName
}

export function EditorIcon({ name, className = '', ...props }:EditorIconProps) {
    return <svg
        {...props}
        className={`editor-icon ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        {name === 'new-file' && <>
            <path d="M6 3.5h7l5 5V20.5H6z" />
            <path d="M13 3.5v5h5M9 15h6M12 12v6" />
        </>}
        {name === 'open' && <>
            <path d="M3.5 19.5 5.6 9h15l-2.1 10.5z" />
            <path d="M5.5 9V5h6l2 2h5v2" />
        </>}
        {name === 'export' && <>
            <path d="M12 3v11M8 10l4 4 4-4" />
            <path d="M5 15v5h14v-5" />
        </>}
        {name === 'skip-back' && <>
            <path d="M6 5v14M18 6l-8 6 8 6z" />
        </>}
        {name === 'skip-forward' && <>
            <path d="M18 5v14M6 6l8 6-8 6z" />
        </>}
        {name === 'play' && <path d="m8 5 11 7-11 7z" />}
        {name === 'pause' && <>
            <path d="M8 5v14M16 5v14" />
        </>}
        {name === 'replay' && <>
            <path d="M4.5 10a8 8 0 1 1 1.8 7.4" />
            <path d="M4.5 5v5h5" />
        </>}
        {name === 'loading' && <>
            <circle cx="12" cy="12" r="8" opacity="0.25" />
            <path className="editor-icon-spinner" d="M12 4a8 8 0 0 1 8 8" />
        </>}
        {name === 'target' && <>
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="1.5" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </>}
        {name === 'audio-file' && <>
            <path d="M4 19.5V5.5h7l2 2h7v12z" />
            <path d="M14 11.5v5.2a1.8 1.8 0 1 1-1.5-1.8H14l4-1v1.8a1.8 1.8 0 1 1-1.5-1.8H18v-4.4z" />
        </>}
        {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
        {name === 'return-edit' && <>
            <path d="M10 6 4 12l6 6M4 12h10" />
            <path d="m14.5 17.5 4-4 2 2-4 4-3 .8z" />
        </>}
        {name === 'align' && <>
            <path d="M4 6h12M4 12h16M4 18h12M8 3v18" />
        </>}
        {name === 'delete' && <>
            <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </>}
        {name === 'add-object' && <>
            <path d="m4 8 8-4 8 4-8 4zM4 12l8 4 4-2M4 16l8 4 3-1.5" />
            <path d="M19 13v6M16 16h6" />
        </>}
        {name === 'add-note' && <>
            <path d="M9 5v11.2a2.5 2.5 0 1 1-2-2.4h2l7-2V7z" />
            <path d="M19 3v6M16 6h6" />
        </>}
        {name === 'add-event' && <>
            <path d="m9.5 3-5 9h6l-1 9 5-9h-6z" />
            <path d="M19 5v6M16 8h6" />
        </>}
    </svg>
}

type EditorIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    icon:EditorIconName
    label:string
}

export function EditorIconButton({
    icon,
    label,
    className = '',
    title = label,
    type = 'button',
    ...props
}:EditorIconButtonProps) {
    return <button
        {...props}
        type={type}
        className={`editor-icon-button ${className}`}
        aria-label={label}
        title={title}
        data-editor-icon={icon}
    >
        <EditorIcon name={icon} />
    </button>
}
