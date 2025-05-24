import prompts from "prompts";
import { execa } from "execa";
import fs from "fs-extra";
import ora from "ora";
import path from "path";
import chalk from "chalk";

const QUESTIONS = [
  {
    type: "text",
    name: "projectName",
    message: "Project name:",
    validate: (name) => (name ? true : "Project name is required"),
  },
  {
    type: "select",
    name: "framework",
    message: "Choose a framework:",
    choices: [
      { title: "React", value: "react" },
      { title: "Next.js (coming soon)", value: "next", disabled: true },
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
    type: "select",
    name: "bundler",
    message: "Choose a bundler:",
    choices: [
      { title: "Vite", value: "vite" },
      { title: "Webpack (coming soon)", value: "webpack", disabled: true },
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

export async function main() {
  console.log(
    chalk.cyanBright.bold("\n✨ Welcome to Create Minimal Template ✨")
  );
  console.log(
    chalk.gray("👉 Let’s build your React + Vite project step by step\n")
  );

  const response = await prompts(QUESTIONS);

  const { projectName, language, helpers } = response;
  const projectDir = path.join(process.cwd(), projectName);

  const spinner = ora("Scaffolding project...").start();

  try {
    const viteTemplate = language === "ts" ? "react-ts" : "react";
    await execa(
      "npm",
      ["create", "vite@latest", projectName, "--", "--template", viteTemplate],
      { stdio: "ignore" }
    );
    await execa("npm", ["install"], { stdio: "ignore" });

    spinner.succeed("Project scaffolded with Vite and React");

    process.chdir(projectDir);

    await fs.remove(path.join(projectDir, "public"));
    await fs.remove(path.join(projectDir, "src", "App.css"));
    await fs.remove(path.join(projectDir, "src", "assets"));

    const deps = [];

    if (helpers.includes("tailwind")) {
      deps.push("tailwindcss", "postcss", "autoprefixer");
    }
    if (helpers.includes("eslint")) {
      deps.push("eslint");
    }
    if (helpers.includes("react-router-dom")) {
      deps.push("react-router-dom");
    }
    if (helpers.includes("redux")) {
      deps.push("@reduxjs/toolkit", "react-redux");
    }

    if (deps.length) {
      spinner.start("Installing helper packages...");
      await execa("npm", ["install", ...deps], { stdio: "ignore" });
      spinner.succeed("Dependencies installed");
    }

    if (helpers.includes("tailwind")) {
      spinner.start("Setting up Tailwind CSS");
      await execa("npx", ["tailwindcss", "init", "-p"], { stdio: "ignore" });

      const cssFile = path.join("src", "index.css");
      await fs.writeFile(
        cssFile,
        `:root {\n  /* your minimal variables */\n}\n\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`
      );

      spinner.succeed("Tailwind CSS configured");
    } else {
      const cssFile = path.join("src", "index.css");
      await fs.writeFile(
        cssFile,
        `:root {\n  /* your minimal variables */\n}\n`
      );
    }

    const appFile = path.join("src", language === "ts" ? "App.tsx" : "App.jsx");
    await fs.writeFile(
      appFile,
      `export default function App() {\n  return <div>🚀 Welcome to your minimal React setup! Let's build something awesome.</div>;\n}`
    );

    const indexHtml = path.join("index.html");
    let htmlContent = await fs.readFile(indexHtml, "utf-8");
    htmlContent = htmlContent.replace(
      /<title>.*<\/title>/,
      `<title>${projectName}</title>`
    );
    await fs.writeFile(indexHtml, htmlContent);

    const readmePath = path.join("README.md");
    await fs.writeFile(readmePath, `# ${projectName}\n`);

    console.log(
      chalk.greenBright.bold(
        `\n🎉 Woohoo! Your project \"${projectName}\" is ready.`
      )
    );
    console.log(`\n👉 Next steps:\n`);
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan(`  npm run dev`));
    console.log(`\nHappy Coding, rockstar! 🚀\n`);
  } catch (err) {
    spinner.fail("Something went wrong");
    console.error(chalk.red(err.message));
  }
}
