/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HA_URL: string;
  readonly VITE_HA_TOKEN: string;
  readonly VITE_DFSU_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
