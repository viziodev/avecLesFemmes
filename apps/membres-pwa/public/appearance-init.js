// Apply before the first paint, including on the offline login screen.
(() => {
  let preference = 'system';
  try {
    preference = localStorage.getItem('alf:pwa:appearance') || 'system';
  } catch {}
  const dark =
    preference === 'dark' ||
    (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.pwaTheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#101a16' : '#f6f8f7';
})();
