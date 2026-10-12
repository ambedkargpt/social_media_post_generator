import Chakra from './Chakra';

/**
 * Nothing here yet, and exactly one thing to do about it. Two actions in an
 * empty state means the product does not know what the reader came for.
 */
export default function EmptyState({ title, children, action }) {
  return (
    <div style={{
      display: 'grid', justifyItems: 'center', textAlign: 'center',
      gap: 14, padding: '48px 24px', color: 'var(--color-np-muted)',
    }}>
      <Chakra size={64} mode="static" className="np-empty-chakra" />
      <h3 className="np-display" style={{ margin: 0, fontSize: 22, color: 'var(--color-np-text)' }}>
        {title}
      </h3>
      {children && <p style={{ margin: 0, maxWidth: '46ch', fontSize: 15 }}>{children}</p>}
      {action}
    </div>
  );
}
