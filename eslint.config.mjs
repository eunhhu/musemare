import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
    ...nextVitals,
    ...nextTypeScript,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern:'^_',
                caughtErrorsIgnorePattern:'^_',
                destructuredArrayIgnorePattern:'^_',
                varsIgnorePattern:'^_',
            }],
        },
    },
    {
        // Browser hydration and the legacy editor intentionally synchronize state from external APIs.
        files: [
            'app/editor/EditorClient.tsx',
            'app/main.tsx',
            'app/scenes/Selector.tsx',
        ],
        rules: {
            'react-hooks/set-state-in-effect': 'off',
        },
    },
    globalIgnores([
        '.next/**',
        'coverage/**',
        'test-results/**',
        'next-env.d.ts',
    ]),
])
