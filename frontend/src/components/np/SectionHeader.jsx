/**
 * A section's title, with an underline that is a rule rather than a border
 * on a box. The right slot takes one link or one filter - never both, and
 * never a row of chips, which is what turns a page into a toolbar.
 */
export default function SectionHeader({ children, right, className = '', style }) {
  return (
    <div
      className={`np-section-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 12,
        borderBottom: '1px solid var(--color-np-rule-strong)',
        ...style,
      }}
    >
      <h2 className="np-display" style={{ margin: 0, fontSize: 30, color: 'var(--color-np-text)' }}>
        {children}
      </h2>
      {right && <div style={{ flex: 'none' }}>{right}</div>}
    </div>
  );
}
