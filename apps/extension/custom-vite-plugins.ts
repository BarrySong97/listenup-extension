/**
 * @purpose 扩展专用的两个 Vite 插件：生产构建剔除 dev icon、可选注入 i18n locale 资源。
 * @role    被 vite.config.base.ts 引用；构建期插件，不进运行时产物。
 * @deps    vite PluginOption、node fs/path、src/locales/
 * @gotcha  production 必须清掉 16/32/48/128 全部 dev icon；crxI18n 当前未启用。见 docs/modules/extension/build-and-manifest.md
 */
import fs from 'fs';
import { resolve } from 'path';
import type { PluginOption } from 'vite';

// plugin to remove dev icons from prod build
export function stripDevIcons (isDev: boolean) {
  if (isDev) return null

  const devIconSizes = [16, 32, 48, 128]

  return {
    name: 'strip-dev-icons',
    resolveId (source: string) {
      return source === 'virtual-module' ? source : null
    },
    renderStart (outputOptions: any, inputOptions: any) {
      const outDir = outputOptions.dir
      devIconSizes.forEach((size) => {
        const fileName = `dev-icon-${size}.png`
        fs.rm(resolve(outDir, fileName), () => console.log(`Deleted ${fileName} from prod build`))
      })
    }
  }
}

// plugin to support i18n 
export function crxI18n (options: { localize: boolean, src: string }): PluginOption {
  if (!options.localize) return null

  const getJsonFiles = (dir: string): Array<string> => {
    const files = fs.readdirSync(dir, {recursive: true}) as string[]
    return files.filter(file => !!file && file.endsWith('.json'))
  }
  const entry = resolve(__dirname, options.src)
  const localeFiles = getJsonFiles(entry)
  const files = localeFiles.map(file => {
    return {
      id: '',
      fileName: file,
      source: fs.readFileSync(resolve(entry, file))
    }
  })
  return {
    name: 'crx-i18n',
    enforce: 'pre',
    buildStart: {
      order: 'post',
      handler() {
        files.forEach((file) => {
            const refId = this.emitFile({
              type: 'asset',
              source: file.source,
              fileName: '_locales/'+file.fileName
            })
            file.id = refId
        })
      }
    }
  }
}
