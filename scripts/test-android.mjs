import { spawnSync } from "node:child_process";
import console from "node:console";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const exampleProject = join(repositoryRoot, "example");
const androidProject = join(repositoryRoot, "example", "android");
const resultsDirectory = join(
  repositoryRoot,
  "android",
  "build",
  "test-results",
  "testDebugUnitTest",
);
const startedAt = Date.now();

if (!existsSync(androidProject)) {
  console.log("Preparing Android project with Expo prebuild...");
  const prebuild = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["expo", "prebuild", "--platform", "android", "--no-install"],
    {
      cwd: exampleProject,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    },
  );
  const prebuildOutput = [prebuild.stdout, prebuild.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();

  if (prebuild.error || prebuild.status !== 0) {
    if (prebuildOutput) {
      console.error(prebuildOutput);
    }
    console.error(
      prebuild.error?.message ??
        `Expo prebuild failed with exit code ${prebuild.status ?? "unknown"}.`,
    );
    process.exit(prebuild.status ?? 1);
  }
}

const listReportFiles = () =>
  readdirSync(resultsDirectory)
    .filter((file) => file.startsWith("TEST-") && file.endsWith(".xml"))
    .sort();

let previousReports = new Map();
if (existsSync(resultsDirectory)) {
  previousReports = new Map(
    listReportFiles().map((file) => [
      file,
      statSync(join(resultsDirectory, file)).mtimeMs,
    ]),
  );
}

const gradle = spawnSync(
  join(androidProject, "gradlew"),
  [
    ":expo-speech-recognition:testDebugUnitTest",
    "--console=plain",
    "--warning-mode=none",
  ],
  {
    cwd: androidProject,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  },
);

const buildOutput = [gradle.stdout, gradle.stderr].filter(Boolean).join("\n").trim();

let reportFiles;
try {
  reportFiles = listReportFiles();
} catch (error) {
  if (buildOutput) {
    console.error(buildOutput);
  }
  console.error(`Gradle succeeded, but its JUnit results could not be read: ${error.message}`);
  process.exit(1);
}

if (reportFiles.length === 0) {
  if (buildOutput) {
    console.error(buildOutput);
  }
  console.error("Gradle succeeded, but it produced no Android unit-test results.");
  process.exit(1);
}

const hasFreshResults = reportFiles.some(
  (file) =>
    statSync(join(resultsDirectory, file)).mtimeMs !== previousReports.get(file),
);

if ((gradle.error || gradle.status !== 0) && !hasFreshResults) {
  if (buildOutput) {
    console.error(buildOutput);
  }
  console.error(
    gradle.error?.message ??
      `Android unit tests failed before producing results (exit code ${gradle.status ?? "unknown"}).`,
  );
  process.exit(gradle.status ?? 1);
}

const decodeXml = (value) =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const attribute = (attributes, name) => {
  const match = attributes.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : "";
};

let passed = 0;
let skipped = 0;
let failed = 0;

for (const reportFile of reportFiles) {
  const xml = readFileSync(join(resultsDirectory, reportFile), "utf8");
  const suiteAttributes = xml.match(/<testsuite\b([^>]*)>/)?.[1] ?? "";
  const suiteName = attribute(suiteAttributes, "name").split(".").at(-1);

  console.log(suiteName);

  const testCases = xml.matchAll(
    /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g,
  );
  for (const testCase of testCases) {
    const name = attribute(testCase[1], "name").replace(/\(\)$/, "");
    const body = testCase[2] ?? "";
    const failure = body.match(
      /<(?:failure|error)\b([^>]*)>([\s\S]*?)<\/(?:failure|error)>/,
    );

    if (failure) {
      failed += 1;
      console.log(`  ✗ ${name}`);
      const message = attribute(failure[1], "message").replace(
        /^[\w.$]+(?:Error|Exception):\s*/,
        "",
      );
      if (message) {
        console.log(`    ${message}`);
      }
      const location = decodeXml(failure[2])
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("at expo.modules.speechrecognition."));
      if (location) {
        console.log(`    ${location}`);
      }
    } else if (/<skipped\b/.test(body)) {
      skipped += 1;
      console.log(`  ○ ${name}`);
    } else {
      passed += 1;
      console.log(`  ✓ ${name}`);
    }
  }
}

const summary = [`${passed} passed`];
if (skipped > 0) summary.push(`${skipped} skipped`);
if (failed > 0) summary.push(`${failed} failed`);
console.log(`\n${summary.join(", ")} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

if (failed > 0) {
  process.exit(1);
}

if (gradle.error || gradle.status !== 0) {
  if (buildOutput) {
    console.error(`\n${buildOutput}`);
  }
  process.exit(gradle.status ?? 1);
}
