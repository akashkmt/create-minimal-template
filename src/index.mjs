import { cp } from "fs/promises";
import path from "path";

const __dirname = import.meta.dirname;

const templateMapping = {
  "React + Vite + JavaScript": path.join(__dirname, "templates/react-vite-js"),
  "React + Vite + TypeScript": path.join(__dirname, "templates/react-vite-ts"),
};

async function copyTemplate(targetDir, templateName) {
  const templateDir = templateMapping[templateName];
  try {
    await cp(templateDir, targetDir, { recursive: true });
  } catch (error) {
    console.error("Failed to copy templates:", error);
  }
}

export default copyTemplate;
