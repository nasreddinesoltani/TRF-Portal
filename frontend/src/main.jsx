import React from "react";
import ReactDOM from "react-dom/client";
import { registerLicense } from "@syncfusion/ej2-base";
import App from "./App.jsx";
import "./index.css";

// Register Syncfusion License
registerLicense(
  "Ngo9BigBOggjHTQxAR8/V1JFaF5cXGRCf1FpRmJGdld5fUVHYVZUTXxaS00DNHVRdkdmWH9cc3RSQmhcVkdyWkNWYEg="
);

// Syncfusion CSS imports (Tailwind theme)
import "@syncfusion/ej2-base/styles/tailwind.css";
import "@syncfusion/ej2-buttons/styles/tailwind.css";
import "@syncfusion/ej2-grids/styles/tailwind.css";
import "@syncfusion/ej2-popups/styles/tailwind.css";

// Custom Syncfusion Overrides
import "./styles/datagrid.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
