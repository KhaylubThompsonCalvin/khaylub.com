// The site's one bundled script: the mobile menu disclosure and the Appearance control, loaded once
// from BaseLayout as an external module (no inline script). One file, one request, on every page.
import { setupNavDisclosure } from './nav-disclosure';
import { setupTheme } from './theme';

setupNavDisclosure();
setupTheme();
