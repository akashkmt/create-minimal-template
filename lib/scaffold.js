import prompts from "prompts";
import { execa } from "execa";
import fs from "fs-extra";
import ora from "ora";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function main() {
  console.log(
    chalk.cyanBright.bold("\n✨ Welcome to Create Minimal Template ✨")
  );
  console.log(
    chalk.gray("👉 Let’s build your React + Vite project step by step\n")
  );

  const response = await prompts([
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
  ]);

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

    spinner.succeed("Project scaffolded with Vite and React");

    process.chdir(projectDir);
    spinner.start("Installing helper packages...");

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
      await execa("npm", ["install", ...deps], { stdio: "ignore" });
    }

    spinner.succeed("Dependencies installed");

    if (helpers.includes("tailwind")) {
      spinner.start("Setting up Tailwind CSS");
      await execa("npx", ["tailwindcss", "init", "-p"], { stdio: "ignore" });

      const cssFile = path.join("src", "index.css");
      const tailwindCSS = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;

      if (await fs.pathExists(cssFile)) {
        await fs.appendFile(cssFile, "\n" + tailwindCSS);
      }

      spinner.succeed("Tailwind CSS configured");
    }

    console.log(
      chalk.greenBright.bold(
        `\n🎉 All done! Your project "${projectName}" is ready.`
      )
    );
    console.log(`\n👉 Next steps:\n`);
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan(`  npm run dev`));
    console.log(`\nHappy hacking ✌️\n`);
  } catch (err) {
    spinner.fail("Something went wrong");
    console.error(chalk.red(err.message));
  }
}
