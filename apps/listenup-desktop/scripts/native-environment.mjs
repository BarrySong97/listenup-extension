/**
 * @purpose 读取正式/DEV 的 Extension、Native Host 与 Desktop 标识矩阵。
 * @role    Desktop 构建、Host 安装和卸载脚本的环境配置入口。
 * @deps    config/listenup-environments.json、node fs/path/url
 * @gotcha  不接受 Extension ID 临时覆盖；正式与 DEV 必须始终使用配置中的固定 ID。
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const environmentsPath = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../config/listenup-environments.json"
);

const environments = JSON.parse(await readFile(environmentsPath, "utf8"));

export function parseNativeEnvironmentArgs(rawArgs) {
  const args = rawArgs.filter((argument) => argument !== "--");
  const unknownArgs = args.filter((argument) => argument !== "--dev");
  if (unknownArgs.length > 0) {
    throw new Error(
      `Unknown argument(s): ${unknownArgs.join(", ")}. Only --dev is supported.`
    );
  }

  const environmentName = args.includes("--dev")
    ? "development"
    : "production";
  return {
    environmentName,
    environment: environments[environmentName],
  };
}

export function getBuildEnvironment() {
  const environmentName = process.env.LISTENUP_ENV ?? "production";
  if (!Object.hasOwn(environments, environmentName)) {
    throw new Error(
      `Unknown LISTENUP_ENV=${environmentName}. Expected production or development.`
    );
  }
  return {
    environmentName,
    environment: environments[environmentName],
  };
}
