const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const packagePath = path.join(repoRoot, "package.json");
const lockPath = path.join(repoRoot, "package-lock.json");
const outputPath = path.join(repoRoot, "THIRD_PARTY_NOTICES.generated.md");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getDeclaredPackages(pkg) {
  return [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {})
  ].sort((a, b) => a.localeCompare(b));
}

function nodeModulesPackagePath(name) {
  return path.join(repoRoot, "node_modules", ...name.split("/"), "package.json");
}

function getLockEntry(lock, name) {
  return lock?.packages?.[`node_modules/${name}`] || null;
}

function getPackageInfo(lock, name) {
  const lockEntry = getLockEntry(lock, name);
  const nodePkg = readJson(nodeModulesPackagePath(name));
  return {
    name,
    version: lockEntry?.version || nodePkg?.version || "UNKNOWN",
    license: lockEntry?.license || nodePkg?.license || "UNKNOWN",
    source: lockEntry?.license
      ? "package-lock.json"
      : (nodePkg?.license ? "node_modules package.json" : "manual verification required"),
    dev: !!lockEntry?.dev
  };
}

function renderMarkdown(rows, warnings) {
  const lines = [
    "# Generated Third-Party Notices",
    "",
    "This file is generated from package-lock.json and local node_modules package metadata.",
    "It is support material for review and is not a substitute for checking each package's license text and binary distribution requirements.",
    "",
    "| Package | Version | License | Source | Scope |",
    "| --- | --- | --- | --- | --- |"
  ];
  rows.forEach((row) => {
    lines.push(`| ${row.name} | ${row.version} | ${row.license} | ${row.source} | ${row.dev ? "dev" : "runtime"} |`);
  });
  if (warnings.length) {
    lines.push("", "## Warnings", "");
    warnings.forEach((warning) => lines.push(`- ${warning}`));
  }
  lines.push("", "Generated notices must be reviewed before release.", "");
  return lines.join("\n");
}

function main() {
  const pkg = readJson(packagePath);
  if (!pkg) {
    console.error("Cannot read package.json. No notice file was generated.");
    process.exitCode = 1;
    return;
  }
  const lock = readJson(lockPath);
  const warnings = [];
  if (!lock) warnings.push("package-lock.json was not found or could not be parsed.");
  if (!fs.existsSync(path.join(repoRoot, "node_modules"))) {
    warnings.push("node_modules was not found; package-lock data was used where available.");
  }
  const rows = getDeclaredPackages(pkg).map((name) => getPackageInfo(lock, name));
  rows
    .filter((row) => row.license === "UNKNOWN")
    .forEach((row) => warnings.push(`${row.name} license is UNKNOWN and needs manual verification.`));
  fs.writeFileSync(outputPath, renderMarkdown(rows, warnings), "utf8");
  console.log(`Generated ${path.relative(repoRoot, outputPath)} with ${rows.length} package rows.`);
}

main();
