// The climb's copy, in the owner's own words as shipped in V1 (src/data/copy.js at
// v1.0.0-3d-experiment). Nothing here is invented voice. The name, role line, availability
// statement, and contact links are NOT here: they come from the profile data through the door's
// data attributes (one availability statement site-wide, decision D-18).

export const statement =
  'I build for a better future, so the next generation starts further ahead than I did. I’m a CIS student making interactive 3D and tools for the web. This is a record of the climb, not the arrival.';

export const philosophy = {
  lead: 'The best systems are built one layer at a time.',
  body: 'Growth follows its own timeline. Feeling behind is not the same as failing.',
};

export const footholds = {
  kicker: 'Footholds',
  lede: 'Each one a foothold. Each skill, a trail marked.',
};

export const areasOfFocus = [
  'Web Development',
  'Interactive 3D',
  'Linux & Systems',
  'Python & SQL',
  'Creative Technology',
  'Future Cybersecurity Path',
];

export const spark = {
  kicker: 'The spark wakes',
  line: 'A single loss does not mean you have lost forever.',
};

export const camps = {
  kicker: 'The camps',
  lede: 'Five projects. Each a camp on the trail, a world I built along the way.',
};

export const closingPrinciple =
  'I aimed for the stars and reached the moon. It was farther than I’d ever been. There’s always a taller mountain. I climb for the valley on the other side, the rest I’m still trying to reach.';

export const contactIntro = 'Rise, and climb again. Let’s build something.';

// The five worlds of the Camps beat (V1 src/data/projects.js). Two have a V2 page and link to it;
// the three concepts have no destination yet and render as honest cards, never dead anchors
// (ADR-011 decision 4, P2-FE-09). Status text is the current truth on this site, not V1's.
export type Camp = { id: string; name: string; concept: string; status: string; href?: string };

export const campWorlds: Camp[] = [
  {
    id: 'khaylub',
    name: 'Khaylub.com',
    concept: 'This site is an ongoing record of the climb from beginner to professional.',
    status: 'Live',
    href: '/projects/khaylub-com-v1/',
  },
  {
    id: 'eyesunclouded',
    name: 'EyesUnclouded.ai',
    concept: 'Interactive scenes that train you to read people. Body language, microexpressions, observation.',
    status: 'Concept',
  },
  {
    id: 'cloelia',
    name: 'Cloelia.ai',
    concept: 'An AI guidance service. Specialist advisors that help you think through a hard decision.',
    status: 'Concept',
  },
  {
    id: 'futuregenius',
    name: 'FutureGenius.ai',
    concept: 'An AI learning companion that turns a goal into a path, with milestones, certifications, and projects tied to real outcomes.',
    status: 'Concept',
  },
  {
    id: 'manors',
    name: 'Manors.ai',
    concept: 'Connects homeowners with skilled tradespeople. The tech stays out of the way.',
    status: 'Private beta',
    href: '/projects/manors-ai/',
  },
];
