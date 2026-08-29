const bgUrl = "/img/limeryx-bg.gif";

/**
 * Fixed animated backdrop: the rotating dot-sphere GIF over pure black so the
 * artwork blends seamlessly into the page, plus a subtle CRT scanline overlay.
 */
export function PixelBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      <img
        src={bgUrl}
        alt=""
        className="absolute left-1/2 top-1/2 h-[130vmin] w-[130vmin] -translate-x-1/2 -translate-y-1/2 object-contain opacity-70"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_10%,rgba(0,0,0,0.85)_70%)]" />
      <div className="scanlines absolute inset-0 opacity-40" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}
