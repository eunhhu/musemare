import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { RuntimeStatusProvider, useRuntimeRoute } from './components/RuntimeStatus'
import './styles/globals.scss'

const Game = lazy(() => import('./main'))
const Editor = lazy(() => import('./editor/EditorClient'))
const MapEditor = lazy(() => import('./mapeditor/MapEditorClient'))

function NotFound() {
    useRuntimeRoute('not-found')
    return <main className="RouteNotFound">
        <h1>Page not found</h1>
        <a href="/">Return to MuseMare</a>
    </main>
}

function Route() {
    const pathname = window.location.pathname === '/'
        ? '/'
        : window.location.pathname.replace(/\/+$/, '')
    if (pathname === '/') return <Game />
    if (pathname === '/editor') return <Editor />
    if (pathname === '/mapeditor') return <MapEditor />
    return <NotFound />
}

const container = document.getElementById('root')
if (!container) throw new Error('MuseMare root element is missing.')

createRoot(container).render(
    <StrictMode>
        <RuntimeStatusProvider>
            <Suspense fallback={null}>
                <Route />
            </Suspense>
        </RuntimeStatusProvider>
    </StrictMode>,
)
