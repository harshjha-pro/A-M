// Shared helpers: photo library, navigation context for the prototype, small utilities.
import React from 'react';

export const PHOTOS = {
  hero: '/_blob/be37d1ab36cf7b54988b9485a35890ad',
  engagement: '/_blob/757187117e788780c5f7070ae2ec0d70',
  mehndi: '/_blob/9de5a270ad5f971e8b73ad814421f247',
  night: '/_blob/3b248fd425b89ca76739151a7e07f4e0',
  drapes: '/_blob/fa0e140870c1c0db584fef5f2576bbf0',
  reception: '/_blob/8f7542ccaab480c8b193d1870df66a38',
  phere: '/_blob/709f456b3b889885872e96b98b177694',
  petals: '/_blob/26d2824a5620840de3eb3bba800e7cce',
  lehenga: '/_blob/fb0b96d299708ba23a00f4e69778fbdb',
  sherwani: '/_blob/6f02b499f39b3dfb71a065b85907f1fe',
  feast: '/_blob/5e09a094dfc57f46a832ebdac998c315',
  stage: '/_blob/bf6ea66621985e15a3e97cfbac4d4d83',
};

// Prototype navigation: screens call go('route') on taps. In a static frame it does nothing.
export const GoContext = React.createContext(() => {});
export const useGo = () => React.useContext(GoContext);

// The viewer's role decides which actions a frame shows (owner/partner = admin, family = editor, viewer = view only).
export const RoleContext = React.createContext('owner');
export const useRole = () => React.useContext(RoleContext);
export const isAdmin = (r) => r === 'owner' || r === 'partner';
export const canEdit = (r) => r === 'owner' || r === 'partner' || r === 'family';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function initials(name) {
  return name.replace(/&.*$/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
