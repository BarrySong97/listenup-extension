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
