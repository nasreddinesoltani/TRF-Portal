import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Syncfusion — large UI library with its own chunk
          if (id.includes("node_modules/@syncfusion")) {
            return "vendor-syncfusion";
          }
          // PDF / canvas generation
          if (
            id.includes("node_modules/jspdf") ||
            id.includes("node_modules/html2canvas") ||
            id.includes("node_modules/@react-pdf")
          ) {
            return "vendor-pdf";
          }
          // Charts
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/victory-")
          ) {
            return "vendor-charts";
          }
          // Core React ecosystem
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-is/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/react-toastify/")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
