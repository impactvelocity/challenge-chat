import { useEffect, useRef, useState } from "react";

/** Preview the same 1920×1080 viewport OBS uses, at any panel width. */
export function OverlayPreview({ src, title, className = "" }: { src: string; title: string; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    setScale(node.clientWidth / 1920);
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1920));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div className={`scaled-overlay-frame ${className}`} ref={container}><iframe src={src} title={title} style={{ width: 1920, height: 1080, margin: 0, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", visibility: scale ? "visible" : "hidden" }}/></div>;
}
