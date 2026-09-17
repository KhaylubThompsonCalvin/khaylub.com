// Refuses a production build of the Studio in local storage mode. Local mode writes to the file
// system of whatever machine runs it; the deployed Studio must commit to the repository through
// Keystatic Cloud or the owner's GitHub App (ADR-012 clarification 7). Runs before `astro build`.
const mode = process.env.PUBLIC_KEYSTATIC_STORAGE ?? 'local';
if (mode === 'cloud') {
  if (!process.env.PUBLIC_KEYSTATIC_CLOUD_PROJECT) {
    console.error('studio build: cloud storage needs PUBLIC_KEYSTATIC_CLOUD_PROJECT (team/project from Keystatic Cloud).');
    process.exit(1);
  }
} else if (mode === 'github') {
  if (!process.env.PUBLIC_KEYSTATIC_GITHUB_APP_SLUG) {
    console.error('studio build: github storage needs PUBLIC_KEYSTATIC_GITHUB_APP_SLUG (and the three secrets at runtime).');
    process.exit(1);
  }
} else {
  console.error(`studio build: refused in "${mode}" storage mode; set PUBLIC_KEYSTATIC_STORAGE to cloud or github.`);
  process.exit(1);
}
console.log(`studio build: ${mode} storage`);
