import { createContext, useContext } from 'react';

/**
 * What the dashboard shell offers the page inside it. Kept out of the shell's
 * own module so that file exports only a component, which is what React fast
 * refresh needs to reload it without losing state.
 */
export const ShellContext = createContext({ openMenu: () => {} });

/** The drawer opener, for a page's own header to hang a hamburger on. */
export function useShell() {
  return useContext(ShellContext);
}
