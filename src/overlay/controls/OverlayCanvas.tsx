import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createMockSource } from '@/overlay/mock/source';
import { OverlayProvider, OverlayRenderer, type Display, type Scene, type Side } from '@/overlay/sdk';
import { cn } from '@/lib/cn';
import './canvas.css';

const W = 1920;
const H = 1080;

/** Scale that fits the 1920×1080 canvas inside the element. */
function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setK(Math.min(e.contentRect.width / W, e.contentRect.height / H)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, k };
}

/** The default gameplay still behind the overlay. */
export const MOCK_SHOT = '/mock/gameplay.webp';

type CanvasProps = {
  bg?: 'game' | 'clear' | 'video';
  /** Gameplay image when `bg` is game. */
  shot?: string;
  /** Player URL when `bg` is video (see `embedFor`). */
  video?: string;
  facecam?: boolean;
  /** Action-safe and title-safe frames, centre lines and thirds, for lining things up. */
  guides?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * The overlay's 1920×1080 canvas (an OBS browser source), scaled to fit whatever box it's in, over mock
 * gameplay, a real stream or video, or OBS's transparent checkerboard.
 */
export function OverlayCanvas({ bg = 'game', shot, video, facecam = true, guides, className, children }: CanvasProps) {
  const { ref, k } = useFit();
  return (
    <div ref={ref} className={cn('ov-fit', className)}>
      <div className="ov-canvas" data-bg={bg} style={{ '--k': k } as CSSProperties}>
        {bg === 'game' && <MockGame shot={shot} facecam={facecam} />}
        {bg === 'video' && video && (
          // Keyed on the source so a new link (or sound on) starts a fresh player
          <iframe key={video} className="ov-video" src={video} title="Stream behind the overlay" allow="autoplay; encrypted-media; picture-in-picture" />
        )}
        {bg !== 'game' && facecam && (
          <div className="ov-facecam" aria-hidden="true">
            <div className="ov-face" />
          </div>
        )}
        {children}
        {guides && <Guides />}
      </div>
    </div>
  );
}

/** A gameplay still standing in for the stream, drifting slowly so it reads as video, with a facecam. */
export function MockGame({ shot = MOCK_SHOT, facecam = true }: { shot?: string; facecam?: boolean }) {
  return (
    <div className="ov-game" aria-hidden="true">
      <img className="ov-shot" src={shot} alt="" />
      <div className="ov-vignette" />
      {facecam && (
        <div className="ov-facecam">
          <div className="ov-face" />
        </div>
      )}
    </div>
  );
}

function Guides() {
  return (
    <div className="ov-guides" aria-hidden="true">
      <i className="ov-guide-action" />
      <i className="ov-guide-title" />
      <i className="ov-guide-v" />
      <i className="ov-guide-h" />
      <span className="ov-guide-label">1920 × 1080 · action safe 93% · title safe 90%</span>
    </div>
  );
}

/**
 * The real overlay, drawn by `display`'s theme over a mock session held at `scene`. For settings pages:
 * chat stays busy, but nothing moves the session on until `scene` changes.
 */
export function OverlayPreview({ display, scene, winner = 'streamer', channelName, className }: { display: Display; scene: Scene; winner?: Side; channelName?: string; className?: string }) {
  const [source] = useState(() => createMockSource({ scene, winner, display, channelName, hold: true }));
  useEffect(() => source.controls.seed(scene, winner), [source, scene, winner]);
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <OverlayProvider source={source}>
        <OverlayCanvas>
          <OverlayRenderer theme={display.theme} settings={display.settings} elements={display.elements} />
        </OverlayCanvas>
      </OverlayProvider>
    </div>
  );
}
