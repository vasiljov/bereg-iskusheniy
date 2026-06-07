/* Берег Искушений — Tweaks: accent color scheme only */
const BI_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#B98B4E", "#E6C07A", "#7E5A2C"]
}/*EDITMODE-END*/;

const BI_ACCENTS = [
  ["#B98B4E", "#E6C07A", "#7E5A2C"] // antique brass
];

function BIApp() {
  const [t, setTweak] = useTweaks(BI_TWEAK_DEFAULTS);

  React.useEffect(() => {
    const root = document.documentElement;
    const a = Array.isArray(t.accent) ? t.accent : [t.accent, t.accent, t.accent];
    root.style.setProperty('--accent', a[0]);
    root.style.setProperty('--accent-bright', a[1] || a[0]);
    root.style.setProperty('--accent-deep', a[2] || a[0]);
    // re-point the design-system gold tokens so existing components recolor too
    root.style.setProperty('--gold', a[0]);
    root.style.setProperty('--gold-bright', a[1] || a[0]);
    root.style.setProperty('--gold-deep', a[2] || a[0]);
  }, [t.accent]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Акцент" />
      <TweakColor label="Золото" value={t.accent} options={BI_ACCENTS}
        onChange={(v) => setTweak('accent', v)} />
    </TweaksPanel>
  );
}

(function mountBI() {
  if (!window.useTweaks) { setTimeout(mountBI, 50); return; }
  const host = document.createElement('div');
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<BIApp />);
})();
