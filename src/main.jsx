import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import "./lookdev.css";
import "./mesh-workspace.css";
import "./dropdown-workspace.css";
import "./axis-workspace.css";

createRoot(document.getElementById("root")).render(<App />);
