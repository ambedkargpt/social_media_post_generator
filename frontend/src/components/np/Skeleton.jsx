/**
 * A block the shape of the thing that is coming. Opacity only - a shimmer
 * sweep is a moving gradient, and a moving gradient is a repaint on every
 * frame of a page that has not finished loading yet.
 */
export default function Skeleton({ width = '100%', height = 16, radius = 8, style, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`np-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, background: 'var(--color-np-raised)', ...style }}
    />
  );
}
