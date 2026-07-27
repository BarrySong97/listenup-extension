/**
 * @purpose 全局类型声明：构建期注入的 ListenUp 环境常量以及 svg / json 模块。
 * @role    被整个 extension 源码隐式引用的环境声明。
 * @deps    vite define（见 vite.config.base.ts）
 * @gotcha  环境常量由 Vite 从 config/listenup-environments.json 注入，不是运行时变量
 */
/** 构建期注入（vite define）：native-demo/dev 构建为 true，生产构建为 false */
declare const __LISTENUP_DEV__: boolean;
declare const __LISTENUP_NATIVE_HOST__: string;
declare const __LISTENUP_DEEP_LINK__: string;

declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.SFC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.json' {
  const content: string;
  export default content;
}
