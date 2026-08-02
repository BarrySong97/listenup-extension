/**
 * @purpose Chrome 构建入口：crx 插件 + 输出目录选择。
 * @role    pnpm build:extension / build:extension:native-demo 的配置文件。
 * @deps    vite.config.base.ts、@crxjs/vite-plugin
 * @gotcha  dev 与 production 输出到不同目录（unpacked 扩展 ID 由路径决定），两个扩展才能同时加载
 */
import { resolve } from 'path';
import { mergeConfig, defineConfig } from 'vite';
import { crx, ManifestV3Export } from '@crxjs/vite-plugin';
import baseConfig, { baseManifest, baseBuildOptions } from './vite.config.base'

// dev 构建输出到独立目录：unpacked 扩展 ID 由路径决定，
// 分开目录才能同时加载 dev 和 production 两个扩展
const isDev = process.env.__DEV__ === 'true';
const outDir = resolve(__dirname, isDev ? 'dist_chrome_dev' : 'dist_chrome');

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      crx({
        manifest: baseManifest as ManifestV3Export,
        browser: 'chrome',
        contentScripts: {
          injectCss: true,
        }
      })
    ],
    build: {
      ...baseBuildOptions,
      outDir
    },
  })
)
