/**
 * @purpose 客户端 Provider 包装（HeroUI I18nProvider）。
 * @role    被 layout.tsx 包在 children 外层。
 * @deps    @heroui/react
 * @gotcha  layout 是 server component，需要 client context 的东西都放这里
 */
"use client";

import { I18nProvider } from "@heroui/react";
import type { ReactNode } from "react";

export function ClientProviders({
  lang,
  children,
}: {
  lang: string;
  children: ReactNode;
}) {
  return <I18nProvider locale={lang}>{children}</I18nProvider>;
}
