#!/usr/bin/env node

import inquirer from "inquirer";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import copyTemplate from "../src/index.mjs";

async function getUserInputs() {
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "templateName",
      message: "Please select required template",
      choices: ["React + Vite + JavaScript", "React + Vite + TypeScript"],
    },
    {
      type: "input",
      name: "projectName",
      message: "What is the name of your project?",
      default: "minimal-react-app",
    },
  ]);

  return answers;
}

async function createTemplate() {
  console.log("Welcome to Create Minimal Template!");

  try {
    const { projectName, templateName } = await getUserInputs();

    const TARGET_DIR = join(process.cwd(), projectName);

    if (!existsSync(TARGET_DIR)) {
      mkdirSync(TARGET_DIR, { recursive: true });
    }

    copyTemplate(TARGET_DIR, templateName);

    console.log("Your project created successfully!");
    console.log(`cd ${projectName}`);
    console.log("npm install");
    console.log("npm run dev");
  } catch (error) {
    console.error(
      "An error occurred while creating the your project:",
      error.message
    );
  }
}

createTemplate();
