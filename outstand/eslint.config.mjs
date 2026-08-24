import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Generated sections use <picture> + <img> where the original export served
    // a different file per breakpoint — next/image cannot express that.
    files: ['components/sections/generated/**/*.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    // next-env.d.ts is rewritten by Next.js on every build.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default config;
