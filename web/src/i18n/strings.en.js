// Every word the app shows (DESIGN §8). One file, so Hindi can be added later.
// Placeholders look like {name}; never glue sentences together in code.
export const strings = {
  appName: 'A&M Wedding',
  appNameStaging: 'A&M Staging',
  version: 'Version {version}',

  nav: {
    label: 'Main',
    home: 'Home',
    calendar: 'Calendar',
    tasks: 'Tasks',
    guests: 'Guests',
    more: 'More',
  },
  back: 'Back',

  home: {
    title: 'Home',
    welcome: 'A&M Wedding — version {version}',
    subtitle: 'Ayush & Mahi · Bhilwara · 14–16 Feb 2027',
    buildNote: 'This is the first build. Screens fill in over the next updates.',
    server: 'Server',
    serverChecking: 'Checking…',
    serverOk: 'Connected',
    serverFail: 'Not reachable. Check your internet.',
  },
  calendar: { title: 'Calendar', empty: 'Nothing planned yet. Set your event dates.' },
  tasks: { title: 'Tasks', empty: 'No tasks yet. Tap + to add one.' },
  guests: { title: 'Guests', empty: 'No families yet. Add one, or import your list.' },
  money: { title: 'Money', empty: 'Set your total budget.' },
  documents: { title: 'Documents', empty: 'No documents. Take a photo of a receipt or contract.' },
  settings: { title: 'Settings', empty: 'Wedding details, members and safety will be here.' },
  install: { title: 'Install Guide', empty: 'How to add the app to your Home Screen. Coming in a later update.' },
  login: { title: 'Log in', empty: 'Logging in arrives in the next update.' },
  more: {
    title: 'More',
    money: 'Money',
    documents: 'Documents',
    settings: 'Settings',
    install: 'Install Guide',
  },
  comingSoon: 'Coming soon',
  notFound: { title: 'Not found', body: 'This page does not exist.', home: 'Go to Home' },

  errors: {
    offline: "Couldn't save. Your changes are kept on this phone.",
    server: 'Something went wrong on our side. Your changes are kept.',
    loadFailed: "Couldn't load this. Check your internet and try again.",
    crashTitle: 'Something went wrong',
    crashBody: 'Please close and reopen the app. Your saved work is safe.',
    reload: 'Reopen the app',
  },
  tryAgain: 'Try again',
};

/** t('home.welcome', { version: '1.0.1' }) */
export function t(path, vars = {}) {
  const value = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), strings);
  if (typeof value !== 'string') return path;
  return value.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
