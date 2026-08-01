/**
 * [INPUT]: 依赖 Node.js fs/child_process/path 模块与 extension 源码树
 * [OUTPUT]: 对外提供 manifest JSON 校验与 JavaScript 语法检查
 * [POS]: scripts 的质量入口，被 npm run check 调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(root, "extension/manifest.json"), "utf8"));

if (manifest.manifest_version !== 3) {
  throw new Error("manifest_version must be 3");
}

for (const file of listFiles(join(root, "extension/src"), ".js")) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Project check passed.");

function listFiles(directory, extension) {
  const result = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...listFiles(path, extension));
    if (stat.isFile() && path.endsWith(extension)) result.push(path);
  }

  return result;
}

