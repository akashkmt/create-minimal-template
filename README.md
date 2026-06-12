# create-minimal-template

A CLI tool that scaffolds minimal, production-ready frontend projects. Pick your framework, bundler, language, and helpers — get a clean project with nothing extra.

All packages are resolved to their latest stable versions at scaffold time.

## Usage

```bash
npx create-minimal-template
```

```bash
pnpx create-minimal-template
```

## What you can configure

**Framework**
- React
- Next.js

**Bundler** (React only)
- Vite
- Webpack

**Language**
- JavaScript
- TypeScript

**Helpers**
- Tailwind CSS (v4)
- ESLint
- React Router DOM
- Redux Toolkit

## Examples

### React + Vite + TypeScript

```
? Project name: my-app
? Choose a framework: React
? Choose a bundler: Vite
? Choose a language: TypeScript
? Choose helper packages: Tailwind CSS, ESLint

Project "my-app" is ready.

  cd my-app
  npm run dev
```

### Next.js + TypeScript

```
? Project name: my-next-app
? Choose a framework: Next.js
? Choose a language: TypeScript
? Choose helper packages: Tailwind CSS, Redux Toolkit

Project "my-next-app" is ready.

  cd my-next-app
  npm run dev
```

### React + Webpack + JavaScript

```
? Project name: my-webpack-app
? Choose a framework: React
? Choose a bundler: Webpack
? Choose a language: JavaScript
? Choose helper packages: ESLint, React Router DOM

Project "my-webpack-app" is ready.

  cd my-webpack-app
  npm run dev
```

## Supported configurations

| Framework | Bundler        | Language | Helpers                                    |
|-----------|----------------|----------|--------------------------------------------|
| React     | Vite, Webpack  | JS, TS   | Tailwind, ESLint, React Router DOM, Redux  |
| Next.js   | Built-in       | JS, TS   | Tailwind, ESLint, Redux                    |

## Notes

- React Router DOM is skipped for Next.js (built-in routing covers it)
- Tailwind uses v4 — `@import "tailwindcss"` syntax, no config file needed
- ESLint for Next.js is provided by `create-next-app`; TS projects get `@typescript-eslint` on top
- Webpack projects use `ts-loader` for TypeScript, Babel for JavaScript
