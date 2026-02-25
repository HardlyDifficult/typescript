import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const packagesDir = join(process.cwd(), "packages");
const requiredFields = ["name", "version", "exports", "types", "files", "engines"];

const errors = [];

for (const entry of readdirSync(packagesDir)) {
  const packageDir = join(packagesDir, entry);
  if (!statSync(packageDir).isDirectory()) {
    continue;
  }

  const manifestPath = join(packageDir, "package.json");
  let manifest;

  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    errors.push(`${manifestPath}: unable to read/parse package.json (${String(error)})`);
    continue;
  }

  for (const field of requiredFields) {
    if (!(field in manifest)) {
      errors.push(`${manifestPath}: missing required field \`${field}\`.`);
    }
  }

  if (!Array.isArray(manifest.files) || !manifest.files.includes("dist")) {
    errors.push(`${manifestPath}: \`files\` must include \"dist\".`);
  }

  if (
    typeof manifest.scripts !== "object" ||
    manifest.scripts === null ||
    typeof manifest.scripts.clean !== "string"
  ) {
    errors.push(`${manifestPath}: \`scripts.clean\` must be defined.`);
  } else if (manifest.scripts.clean.includes("rm -rf")) {
    errors.push(
      `${manifestPath}: \`scripts.clean\` must be cross-platform and cannot use \"rm -rf\".`
    );
  }

  if (typeof manifest.exports !== "object" || manifest.exports === null || !("." in manifest.exports)) {
    errors.push(`${manifestPath}: \`exports\` must include a root \".\" export.`);
    continue;
  }

  const rootExport = manifest.exports["."];
  if (typeof rootExport !== "object" || rootExport === null) {
    errors.push(`${manifestPath}: \`exports[\".\"]\` must be an object.`);
    continue;
  }

  if (!("types" in rootExport)) {
    errors.push(`${manifestPath}: \`exports[\".\"]\` must define \`types\`.`);
  }

  if (!("import" in rootExport)) {
    errors.push(`${manifestPath}: \`exports[\".\"]\` must define \`import\`.`);
  }

  if (!("default" in rootExport)) {
    errors.push(`${manifestPath}: \`exports[\".\"]\` must define \`default\`.`);
  }

  if (manifest.type === "commonjs" && !("require" in rootExport)) {
    errors.push(
      `${manifestPath}: commonjs packages must define \`exports[\".\"].require\`.`
    );
  }
}

if (errors.length > 0) {
  console.error("Package manifest validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("All package manifests passed required publish field checks.");
