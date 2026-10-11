// The site's one bundled script: the mobile menu disclosure, the Appearance control, the returning
// header, the search shortcut, and the copy buttons, loaded once from BaseLayout as an external module (no inline script). One file, one request, on every page.
import { setupNavDisclosure } from './nav-disclosure';
import { setupTheme } from './theme';
import { setupHeaderScroll } from './header-scroll';
import { setupSearchShortcut } from './search-shortcut';
import { setupCopy } from './copy';
import { setupAudience } from './audience';

setupNavDisclosure();
setupTheme();
setupHeaderScroll();
setupSearchShortcut();
setupCopy();
setupAudience();
