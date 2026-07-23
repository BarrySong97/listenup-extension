/** 构建期注入（vite define）：native-demo/dev 构建为 true，生产构建为 false */
declare const __LISTENUP_DEV__: boolean;

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
