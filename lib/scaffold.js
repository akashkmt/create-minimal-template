import prompts from "prompts";
import { execa } from "execa";
import fs from "fs-extra";
import ora from "ora";
import path from "path";
import chalk from "chalk";

const versionCache = new Map();

async function resolveLatest(pkg) {
  if (versionCache.has(pkg)) return versionCache.get(pkg);
  try {
    const { stdout } = await execa("npm", ["show", pkg, "version"], { stdio: "pipe" });
    const version = `^${stdout.trim()}`;
    versionCache.set(pkg, version);
    return version;
  } catch {
    return "latest";
  }
}

async function resolveLatestBatch(pkgs) {
  const entries = await Promise.all(
    pkgs.map(async (pkg) => [pkg, await resolveLatest(pkg)])
  );
  return Object.fromEntries(entries);
}

const QUESTIONS = [
  {
    type: "text",
    name: "projectName",
    message: "Project name:",
    validate: (name) => {
      if (!name) return "Project name is required";
      if (!/^[a-z0-9-_]+$/i.test(name)) {
        return "Project name can only contain letters, numbers, hyphens and underscores";
      }
      return true;
    },
  },
  {
    type: "select",
    name: "framework",
    message: "Choose a framework:",
    choices: [
      { title: "React", value: "react" },
      { title: "Next.js", value: "next" },
    ],
  },
  {
    type: (prev) => (prev === "react" ? "select" : null),
    name: "bundler",
    message: "Choose a bundler:",
    choices: [
      { title: "Vite", value: "vite" },
      { title: "Webpack", value: "webpack" },
    ],
  },
  {
    type: "select",
    name: "language",
    message: "Choose a language:",
    choices: [
      { title: "JavaScript", value: "js" },
      { title: "TypeScript", value: "ts" },
    ],
  },
  {
    type: "multiselect",
    name: "helpers",
    message: "Choose helper packages:",
    choices: [
      { title: "Tailwind CSS", value: "tailwind" },
      { title: "ESLint", value: "eslint" },
      { title: "React Router DOM", value: "react-router-dom" },
      { title: "Redux Toolkit", value: "redux" },
    ],
  },
];

// Helper function to setup ESLint
async function setupESLint(projectDir, language, framework) {
  const isTypeScript = language === "ts";
  const eslintConfig = {
    env: {
      browser: true,
      es2021: true,
      node: true,
    },
    extends: [
      "eslint:recommended",
      framework === "react" ? "plugin:react/recommended" : null,
      framework === "react" ? "plugin:react/jsx-runtime" : null,
      isTypeScript ? "plugin:@typescript-eslint/recommended" : null,
    ].filter(Boolean),
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: framework === "react" ? { jsx: true } : undefined,
    },
    settings:
      framework === "react" ? { react: { version: "detect" } } : undefined,
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  };

  if (isTypeScript) {
    eslintConfig.parser = "@typescript-eslint/parser";
    eslintConfig.plugins = ["@typescript-eslint"];
  }

  await fs.writeJSON(path.join(projectDir, ".eslintrc.json"), eslintConfig, {
    spaces: 2,
  });
}

// Helper function to setup ESLint for Next.js (which already has ESLint from create-next-app)
async function setupESLintNextJS(projectDir, language, spinner) {
  if (language === "ts") {
    spinner.start("Installing TypeScript ESLint plugins...");
    try {
      await execa(
        "npm",
        [
          "install",
          "-D",
          "@typescript-eslint/parser",
          "@typescript-eslint/eslint-plugin",
        ],
        { cwd: projectDir, stdio: "pipe" }
      );
      spinner.succeed("TypeScript ESLint plugins installed");
    } catch (error) {
      spinner.fail("Failed to install TypeScript ESLint plugins");
      console.error(chalk.red("\nError:"), error.message);
      throw error;
    }
  } else {
    spinner.info("ESLint already configured by create-next-app");
  }
}

// Helper function to install dependencies
async function installDependencies(deps, devDeps, spinner, cwd) {
  if (deps.length > 0) {
    spinner.start(`Installing dependencies: ${deps.join(", ")}...`);
    try {
      await execa("npm", ["install", ...deps], { cwd, stdio: "pipe" });
      spinner.succeed("Dependencies installed");
    } catch (error) {
      spinner.fail("Failed to install dependencies");
      console.error(chalk.red("\nError:"), error.message);
      if (error.stderr) console.error(chalk.gray(error.stderr));
      throw error;
    }
  }

  if (devDeps.length > 0) {
    spinner.start(`Installing dev dependencies: ${devDeps.join(", ")}...`);
    try {
      await execa("npm", ["install", "-D", ...devDeps], { cwd, stdio: "pipe" });
      spinner.succeed("Dev dependencies installed");
    } catch (error) {
      spinner.fail("Failed to install dev dependencies");
      console.error(chalk.red("\nError:"), error.message);
      if (error.stderr) console.error(chalk.gray(error.stderr));
      throw error;
    }
  }
}

// Setup Tailwind CSS (v4)
async function setupTailwind(projectDir, spinner, useEsm = true) {
  spinner.start("Setting up Tailwind CSS...");

  // Tailwind v4: PostCSS config uses @tailwindcss/postcss plugin
  const postCssConfig = useEsm
    ? `export default {\n  plugins: {\n    '@tailwindcss/postcss': {},\n  },\n};\n`
    : `module.exports = {\n  plugins: {\n    '@tailwindcss/postcss': {},\n  },\n};\n`;
  await fs.writeFile(path.join(projectDir, "postcss.config.js"), postCssConfig);

  const cssFile = path.join(projectDir, "src", "index.css");
  await fs.writeFile(
    cssFile,
    `@import "tailwindcss";

:root {
  /* your minimal variables */
}
`
  );

  spinner.succeed("Tailwind CSS configured");
}

// Setup React with Vite
async function setupReactVite(projectName, language, helpers, spinner) {
  const projectDir = path.join(process.cwd(), projectName);
  const viteTemplate = language === "ts" ? "react-ts" : "react";

  spinner.start("Creating Vite + React project...");
  try {
    await execa(
      "npm",
      ["create", "vite@latest", projectName, "--", "--template", viteTemplate],
      { stdio: "pipe" }
    );
  } catch (error) {
    spinner.fail("Failed to create Vite project");
    console.error(chalk.red("\nError details:"), error.message);
    if (error.stderr) console.error(chalk.gray(error.stderr));
    throw error;
  }

  // Verify directory was created
  if (!(await fs.pathExists(projectDir))) {
    spinner.fail("Project directory was not created");
    throw new Error(`Directory ${projectDir} does not exist after creation`);
  }

  spinner.text = "Installing base dependencies...";
  try {
    await execa("npm", ["install"], { cwd: projectDir, stdio: "pipe" });
  } catch (error) {
    spinner.fail("Failed to install dependencies");
    console.error(chalk.red("\nError installing dependencies:"), error.message);
    if (error.stderr) console.error(chalk.gray(error.stderr));
    throw error;
  }
  spinner.succeed("Project scaffolded with Vite and React");

  // Clean up default files
  await fs.remove(path.join(projectDir, "public"));
  await fs.remove(path.join(projectDir, "src", "App.css"));
  await fs.remove(path.join(projectDir, "src", "assets"));

  const deps = [];
  const devDeps = [];

  if (helpers.includes("tailwind")) {
    devDeps.push("tailwindcss", "@tailwindcss/postcss", "postcss");
  }
  if (helpers.includes("eslint")) {
    devDeps.push("eslint");
    if (language === "ts") {
      devDeps.push(
        "@typescript-eslint/parser",
        "@typescript-eslint/eslint-plugin"
      );
    }
    devDeps.push("eslint-plugin-react");
  }
  if (helpers.includes("react-router-dom")) {
    deps.push("react-router-dom");
  }
  if (helpers.includes("redux")) {
    deps.push("@reduxjs/toolkit", "react-redux");
  }

  await installDependencies(deps, devDeps, spinner, projectDir);

  if (helpers.includes("tailwind")) {
    await setupTailwind(projectDir, spinner);
  } else {
    const cssFile = path.join(projectDir, "src", "index.css");
    await fs.writeFile(cssFile, `:root {\n  /* your minimal variables */\n}\n`);
  }

  if (helpers.includes("eslint")) {
    spinner.start("Setting up ESLint...");
    await setupESLint(projectDir, language, "react");
    spinner.succeed("ESLint configured");
  }

  // Create minimal App component
  const appFile = path.join(
    projectDir,
    "src",
    language === "ts" ? "App.tsx" : "App.jsx"
  );
  await fs.writeFile(
    appFile,
    `export default function App() {
  return (
    <div className="${
      helpers.includes("tailwind")
        ? "min-h-screen flex items-center justify-center bg-gray-100"
        : ""
    }">
      <h1 className="${
        helpers.includes("tailwind") ? "text-4xl font-bold text-blue-600" : ""
      }">
        🚀 Welcome to your minimal React setup!
      </h1>
    </div>
  );
}
`
  );

  // Update index.html title
  const indexHtml = path.join(projectDir, "index.html");
  let htmlContent = await fs.readFile(indexHtml, "utf-8");
  htmlContent = htmlContent.replace(
    /<title>.*<\/title>/,
    `<title>${projectName}</title>`
  );
  await fs.writeFile(indexHtml, htmlContent);

  // Update README
  const readmePath = path.join(projectDir, "README.md");
  await fs.writeFile(
    readmePath,
    `# ${projectName}

Created with create-minimal-template

## Getting Started

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`
`
  );

  return projectDir;
}

// Setup React with Webpack
async function setupReactWebpack(projectName, language, helpers, spinner) {
  const projectDir = path.join(process.cwd(), projectName);

  spinner.start("Resolving latest package versions...");
  const corePkgs = [
    "react", "react-dom",
    "webpack", "webpack-cli", "webpack-dev-server", "html-webpack-plugin",
    "@babel/core", "@babel/preset-env", "@babel/preset-react", "babel-loader",
    "css-loader", "style-loader",
  ];
  const tsPkgs = language === "ts"
    ? ["@types/react", "@types/react-dom", "typescript", "ts-loader"]
    : [];
  const versions = await resolveLatestBatch([...corePkgs, ...tsPkgs]);
  spinner.succeed("Package versions resolved");

  spinner.start("Creating React + Webpack project...");
  await fs.ensureDir(projectDir);

  const packageJson = {
    name: projectName,
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "webpack serve --mode development --open",
      build: "webpack --mode production",
      start: "webpack serve --mode development",
    },
    dependencies: {
      react: versions["react"],
      "react-dom": versions["react-dom"],
    },
    devDependencies: {
      webpack: versions["webpack"],
      "webpack-cli": versions["webpack-cli"],
      "webpack-dev-server": versions["webpack-dev-server"],
      "html-webpack-plugin": versions["html-webpack-plugin"],
      "@babel/core": versions["@babel/core"],
      "@babel/preset-env": versions["@babel/preset-env"],
      "@babel/preset-react": versions["@babel/preset-react"],
      "babel-loader": versions["babel-loader"],
      "css-loader": versions["css-loader"],
      "style-loader": versions["style-loader"],
    },
  };

  if (language === "ts") {
    packageJson.devDependencies["@types/react"] = versions["@types/react"];
    packageJson.devDependencies["@types/react-dom"] = versions["@types/react-dom"];
    packageJson.devDependencies["typescript"] = versions["typescript"];
    packageJson.devDependencies["ts-loader"] = versions["ts-loader"];
  }

  await fs.writeJSON(path.join(projectDir, "package.json"), packageJson, {
    spaces: 2,
  });

  // Create webpack config
  const webpackConfig = `const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.${language === "ts" ? "tsx" : "jsx"}',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  resolve: {
    extensions: [${language === "ts" ? "'.ts', '.tsx', " : ""}'.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\\.(${language === "ts" ? "ts|tsx|" : ""}js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: ${language === "ts" ? "'ts-loader'" : "'babel-loader'"},
        },
      },
      {
        test: /\\.css$/,
        use: ['style-loader', 'css-loader'${
          helpers.includes("tailwind") ? ", 'postcss-loader'" : ""
        }],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      title: '${projectName}',
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    open: true,
  },
};
`;
  await fs.writeFile(path.join(projectDir, "webpack.config.js"), webpackConfig);

  // Create babel config (if not TypeScript)
  if (language !== "ts") {
    const babelConfig = {
      presets: ["@babel/preset-env", "@babel/preset-react"],
    };
    await fs.writeJSON(path.join(projectDir, ".babelrc"), babelConfig, {
      spaces: 2,
    });
  } else {
    // Create tsconfig.json for TypeScript
    const tsConfig = {
      compilerOptions: {
        target: "ES2020",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        jsx: "react-jsx",
        module: "ESNext",
        moduleResolution: "node",
        resolveJsonModule: true,
        allowJs: true,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ["src"],
    };
    await fs.writeJSON(path.join(projectDir, "tsconfig.json"), tsConfig, {
      spaces: 2,
    });
  }

  // Create directory structure
  await fs.ensureDir(path.join(projectDir, "src"));
  await fs.ensureDir(path.join(projectDir, "public"));

  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`;
  await fs.writeFile(path.join(projectDir, "public", "index.html"), indexHtml);

  // Create src files
  const ext = language === "ts" ? "tsx" : "jsx";
  const appContent = `export default function App() {
  return (
    <div className="${
      helpers.includes("tailwind")
        ? "min-h-screen flex items-center justify-center bg-gray-100"
        : ""
    }">
      <h1 className="${
        helpers.includes("tailwind") ? "text-4xl font-bold text-blue-600" : ""
      }">
        🚀 Welcome to your minimal React + Webpack setup!
      </h1>
    </div>
  );
}
`;
  await fs.writeFile(path.join(projectDir, "src", `App.${ext}`), appContent);

  const indexContent = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')${
    language === "ts" ? " as HTMLElement" : ""
  });
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  await fs.writeFile(
    path.join(projectDir, "src", `index.${ext}`),
    indexContent
  );

  spinner.succeed("Project structure created");

  // Install base dependencies
  spinner.start("Installing dependencies...");
  try {
    await execa("npm", ["install"], { cwd: projectDir, stdio: "pipe" });
    spinner.succeed("Base dependencies installed");
  } catch (error) {
    spinner.fail("Failed to install dependencies");
    console.error(chalk.red("\nError:"), error.message);
    if (error.stderr) console.error(chalk.gray(error.stderr));
    throw error;
  }

  // Install helper packages
  const deps = [];
  const devDeps = [];

  if (helpers.includes("tailwind")) {
    devDeps.push("tailwindcss", "@tailwindcss/postcss", "postcss", "postcss-loader");
  }
  if (helpers.includes("eslint")) {
    devDeps.push("eslint", "eslint-plugin-react");
    if (language === "ts") {
      devDeps.push(
        "@typescript-eslint/parser",
        "@typescript-eslint/eslint-plugin"
      );
    }
  }
  if (helpers.includes("react-router-dom")) {
    deps.push("react-router-dom");
  }
  if (helpers.includes("redux")) {
    deps.push("@reduxjs/toolkit", "react-redux");
  }

  await installDependencies(deps, devDeps, spinner, projectDir);

  if (helpers.includes("tailwind")) {
    await setupTailwind(projectDir, spinner, false);
  } else {
    const cssFile = path.join(projectDir, "src", "index.css");
    await fs.writeFile(cssFile, `:root {\n  /* your minimal variables */\n}\n`);
  }

  if (helpers.includes("eslint")) {
    spinner.start("Setting up ESLint...");
    await setupESLint(projectDir, language, "react");
    spinner.succeed("ESLint configured");
  }

  // Update README
  const readmePath = path.join(projectDir, "README.md");
  await fs.writeFile(
    readmePath,
    `# ${projectName}

Created with create-minimal-template (React + Webpack)

## Getting Started

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`
`
  );

  return projectDir;
}

// Setup Next.js
async function setupNextJS(projectName, language, helpers, spinner) {
  const projectDir = path.join(process.cwd(), projectName);

  spinner.start("Creating Next.js project...");
  try {
    await execa(
      "npx",
      [
        "create-next-app@latest",
        projectName,
        language === "ts" ? "--typescript" : "--no-typescript",
        "--eslint",
        "--app",
        "--no-tailwind",
        "--import-alias",
        "@/*",
        "--use-npm",
      ],
      { stdio: "pipe" }
    );
    spinner.succeed("Next.js project created");
  } catch (error) {
    spinner.fail("Failed to create Next.js project");
    console.error(chalk.red("\nError:"), error.message);
    if (error.stderr) console.error(chalk.gray(error.stderr));
    throw error;
  }

  // Verify directory was created
  if (!(await fs.pathExists(projectDir))) {
    spinner.fail("Project directory was not created");
    throw new Error(`Directory ${projectDir} does not exist after creation`);
  }

  const deps = [];
  const devDeps = [];

  if (helpers.includes("tailwind")) {
    devDeps.push("tailwindcss", "@tailwindcss/postcss", "postcss");
  }
  if (helpers.includes("react-router-dom")) {
    spinner.warn(
      "React Router DOM is not needed in Next.js (built-in routing)"
    );
  }
  if (helpers.includes("redux")) {
    deps.push("@reduxjs/toolkit", "react-redux");
  }

  await installDependencies(deps, devDeps, spinner, projectDir);

  if (helpers.includes("eslint")) {
    await setupESLintNextJS(projectDir, language, spinner);
  }

  if (helpers.includes("tailwind")) {
    // Tailwind v4 PostCSS config
    const postCssConfig = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
`;
    await fs.writeFile(path.join(projectDir, "postcss.config.js"), postCssConfig);

    // Update globals.css with v4 import syntax
    const globalsFile = path.join(projectDir, "app", "globals.css");
    await fs.writeFile(
      globalsFile,
      `@import "tailwindcss";

:root {
  /* your minimal variables */
}
`
    );
  }

  // Create a minimal home page
  const pageFile = path.join(
    projectDir,
    "app",
    language === "ts" ? "page.tsx" : "page.jsx"
  );
  await fs.writeFile(
    pageFile,
    `export default function Home() {
  return (
    <main className="${
      helpers.includes("tailwind")
        ? "min-h-screen flex items-center justify-center bg-gray-100"
        : ""
    }">
      <h1 className="${
        helpers.includes("tailwind") ? "text-4xl font-bold text-blue-600" : ""
      }">
        🚀 Welcome to your minimal Next.js setup!
      </h1>
    </main>
  );
}
`
  );

  // Update README
  const readmePath = path.join(projectDir, "README.md");
  await fs.writeFile(
    readmePath,
    `# ${projectName}

Created with create-minimal-template (Next.js)

## Getting Started

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

\`\`\`bash
npm run build
npm start
\`\`\`
`
  );

  return projectDir;
}

export async function main() {
  console.log(
    chalk.cyanBright.bold("\n✨ Welcome to Create Minimal Template ✨")
  );
  console.log(chalk.gray("👉 Let's build your project step by step\n"));

  const response = await prompts(QUESTIONS, {
    onCancel: () => {
      console.log(chalk.red("\n❌ Operation cancelled"));
      process.exit(0);
    },
  });

  if (!response.projectName) {
    console.log(chalk.red("\n❌ Project name is required"));
    process.exit(1);
  }

  const { projectName, framework, bundler, language, helpers } = response;

  // Check if directory already exists
  const targetDir = path.join(process.cwd(), projectName);
  if (await fs.pathExists(targetDir)) {
    console.log(chalk.red(`\n❌ Directory "${projectName}" already exists`));
    process.exit(1);
  }

  const spinner = ora();

  try {
    if (framework === "next") {
      await setupNextJS(projectName, language, helpers || [], spinner);
    } else if (framework === "react") {
      if (bundler === "vite") {
        await setupReactVite(projectName, language, helpers || [], spinner);
      } else if (bundler === "webpack") {
        await setupReactWebpack(projectName, language, helpers || [], spinner);
      }
    }

    console.log(
      chalk.greenBright.bold(
        `\n🎉 Woohoo! Your project "${projectName}" is ready.`
      )
    );
    console.log(`\n👉 Next steps:\n`);
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan(`  npm run dev`));
    console.log(`\nHappy Coding, rockstar! 🚀\n`);
  } catch (err) {
    spinner.fail("Something went wrong");
    console.error(chalk.red(`\n❌ Error: ${err.message}`));
    console.error(chalk.gray(err.stack));
    await fs.remove(targetDir).catch(() => {});
    process.exit(1);
  }
}
