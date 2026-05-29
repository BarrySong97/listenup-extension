import React from "react";
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import Newtab from "@pages/newtab/Newtab";
import "@pages/newtab/index.css";
import "@pages/content/style.css";

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Newtab root element");
  const root = createRoot(rootContainer);
  root.render(
    <HeroUIProvider>
      <Newtab />
    </HeroUIProvider>
  );
}

init();
