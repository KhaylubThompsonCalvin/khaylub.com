interface ImportMetaEnv {
  readonly PUBLIC_KEYSTATIC_STORAGE?: 'local' | 'cloud' | 'github';
  readonly PUBLIC_KEYSTATIC_CLOUD_PROJECT?: string;
  readonly PUBLIC_KEYSTATIC_GITHUB_APP_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
