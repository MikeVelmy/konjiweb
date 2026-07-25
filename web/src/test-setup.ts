/**
 * jsdom does not implement matchMedia, which the theme provider uses to follow
 * the OS colour scheme. Every real browser has had it since IE10, so this is a
 * test-environment gap rather than something the app should defend against.
 * The stub reports "not light", matching the dark default.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
