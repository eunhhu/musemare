import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
    globalIgnores([
        'dist/**',
        'coverage/**',
        'test-results/**',
    ]),
    {
        files:['**/*.{ts,tsx}'],
        extends:[
            js.configs.recommended,
            ...tseslint.configs.recommended,
            react.configs.flat.recommended,
            react.configs.flat['jsx-runtime'],
            reactHooks.configs.flat['recommended-latest'],
            reactRefresh.configs.vite,
            jsxA11y.flatConfigs.recommended,
        ],
        languageOptions:{
            ecmaVersion:'latest',
            globals:{
                ...globals.browser,
                ...globals.node,
            },
        },
        settings:{ react:{ version:'detect' } },
        rules:{
            '@typescript-eslint/no-unused-vars':['error', {
                argsIgnorePattern:'^_',
                caughtErrorsIgnorePattern:'^_',
                destructuredArrayIgnorePattern:'^_',
                varsIgnorePattern:'^_',
            }],
            'react/no-unknown-property':['error', {
                ignore:['alpha', 'draw', 'pivot', 'rotation', 'text', 'texture'],
            }],
        },
    },
    {
        // Browser hydration and the legacy editor intentionally synchronize state from external APIs.
        files:[
            'app/editor/EditorClient.tsx',
            'app/main.tsx',
            'app/scenes/Selector.tsx',
        ],
        rules:{
            'react-hooks/set-state-in-effect':'off',
        },
    },
    {
        // These modules intentionally expose React bindings together with runtime/domain helpers.
        files:[
            'app/components/RuntimeStatus.tsx',
            'app/components/GameSession.tsx',
            'app/data/utils.tsx',
            'app/entry.tsx',
            'app/main.tsx',
        ],
        rules:{
            'react-refresh/only-export-components':'off',
        },
    },
    {
        // Canvas timelines and map handles implement pointer interaction outside native controls.
        files:[
            'app/editor/EditorClient.tsx',
            'app/mapeditor/MapEditorClient.tsx',
        ],
        rules:{
            'jsx-a11y/click-events-have-key-events':'off',
            'jsx-a11y/no-static-element-interactions':'off',
        },
    },
    {
        // Gameplay music and editor transport audio do not contain spoken dialogue.
        files:[
            'app/editor/EditorClient.tsx',
            'app/scenes/Battle.tsx',
        ],
        rules:{
            'jsx-a11y/media-has-caption':'off',
        },
    },
    {
        // The legacy map inspector groups adjacent labels and controls in generated rows.
        files:['app/mapeditor/MapEditorClient.tsx'],
        rules:{
            'jsx-a11y/label-has-associated-control':'off',
        },
    },
])
