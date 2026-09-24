// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig } from "electron-vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
var electron_vite_config_default = defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
        "@renderer": resolve("src/renderer/src"),
        "@resources": resolve("resources")
      }
    },
    plugins: [vue(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      watch: {
        ignored: ["**/src/renderer/workflows/**"]
      },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
          secure: false,
          ws: true
        },
        "/ws": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
          secure: false,
          ws: true
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
