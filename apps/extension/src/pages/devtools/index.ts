/**
 * @purpose 在浏览器 DevTools 里注册一个名为 Dev Tools 的面板。
 * @role    manifest 的 devtools_page 入口，目前只有注册逻辑。
 * @deps    webextension-polyfill
 * @gotcha  预留扩展面；未来的字幕调试工具适合放这里。见 docs/modules/extension/entry-pages.md
 */
import Browser from 'webextension-polyfill';

Browser
  .devtools
  .panels
  .create('Dev Tools', 'icon-32.png', 'src/pages/devtools/index.html')
  .catch(console.error);
