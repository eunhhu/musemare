import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    appType:'spa',
    plugins:[react()],
    server:{
        host:'127.0.0.1',
        port:3000,
        strictPort:true,
    },
    preview:{
        host:'127.0.0.1',
        port:3100,
        strictPort:true,
    },
    build:{
        outDir:'dist',
        sourcemap:true,
        target:'es2022',
    },
})
