// The site's one bundled script: the mobile menu disclosure, the Appearance control, and the returning
// header, loaded once from BaseLayout as an external module (no inline script). One file, one request, on every page.
import { setupNavDisclosure } from './nav-disclosure';
import { setupTheme } from './theme';
import { setupHeaderScroll } from './header-scroll';

setupNavDisclosure();
setupTheme();
setupHeaderScroll();
