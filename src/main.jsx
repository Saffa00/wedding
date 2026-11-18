import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/cormorant-garamond/latin-600.css"; // self-hosted so it works offline
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remove the loading screen once the app has painted
requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("boot")?.remove()));
