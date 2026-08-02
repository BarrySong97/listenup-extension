/**
 * @purpose PostCSS 配置，接入 Tailwind v4。
 * @role    Next 构建期读取。
 * @deps    @tailwindcss/postcss
 * @gotcha  无
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
