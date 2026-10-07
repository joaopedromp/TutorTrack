import {build} from 'vite';
import tailwind from '@tailwindcss/vite';
await build({configFile:false,envFile:false,resolve:{preserveSymlinks:true},plugins:[tailwind()],build:{outDir:'dist-desktop',minify:'esbuild',target:'esnext'}});
