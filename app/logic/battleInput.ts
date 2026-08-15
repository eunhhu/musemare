type GameplayKeyboardInput = Pick<KeyboardEvent, 'code' | 'isComposing' | 'repeat'>

export function isGameplayKeyboardInput(event:GameplayKeyboardInput) {
    return event.code.length > 0 && !event.isComposing && !event.repeat
}
