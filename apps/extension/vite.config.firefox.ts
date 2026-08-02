/**
 * @purpose Firefox 构建入口：把通用 MV3 manifest 转成 Firefox 分支需要的形态。
 * @role    pnpm build:firefox 的配置文件。
 * @deps    vite.config.base.ts、@crxjs/vite-plugin
 * @gotcha  background.service_worker → background.scripts 的转换只能写在这里；不要为 Firefox 去改 manifest.json，会弄坏 Chrome 构建
 */
import { resolve } from 'path';
import { mergeConfig, defineConfig } from 'vite';
import { crx, ManifestV3Export } from '@crxjs/vite-plugin';
import baseConfig, { baseManifest, baseBuildOptions } from './vite.config.base'

const outDir = resolve(__dirname, 'dist_firefox');
const firefoxManifest = {
  ...baseManifest,
  background: baseManifest.background?.service_worker
    ? {
        scripts: [baseManifest.background.service_worker],
        type: baseManifest.background.type,
      }
    : baseManifest.background,
} as unknown as ManifestV3Export;

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      crx({
        manifest: firefoxManifest,
        browser: 'firefox',
        contentScripts: {
          injectCss: true,
        }
      })
    ],
    build: {
      ...baseBuildOptions,
      outDir
    },
    publicDir: resolve(__dirname, 'public'),
  })
)
