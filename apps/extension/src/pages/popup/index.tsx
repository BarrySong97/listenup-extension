import React from "react";
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import "@pages/popup/index.css";
import "@pages/content/style.css";
import Popup from "@pages/popup/Popup";

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Popup root element");
  const root = createRoot(rootContainer);
  root.render(
    <HeroUIProvider>
      <Popup />
    </HeroUIProvider>
  );
}

init();
