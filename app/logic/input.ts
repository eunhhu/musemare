type EditableTarget = EventTarget & {
    tagName?:string
    isContentEditable?:boolean
    closest?:(selector:string) => unknown
}

export function isEditableTarget(target:EventTarget | null) {
    if (!target || typeof target !== 'object') return false
    const element = target as EditableTarget
    const tagName = element.tagName?.toLowerCase()
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true
    if (element.isContentEditable) return true
    return Boolean(element.closest?.('[contenteditable="true"], [contenteditable=""]'))
}
