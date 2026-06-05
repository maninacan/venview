import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  headerRight?: ReactNode;
}

export function CollapsibleCard({ title, children, defaultOpen = false, headerRight }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="sheet-card">
      <button
        className="sheet-header"
        onClick={() => setOpen(o => !o)}
        type="button"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {headerRight}
          <span className="sheet-arrow" style={{ transform: open ? 'rotate(180deg)' : undefined }}>▼</span>
        </span>
      </button>
      <div className={`sheet-content ${open ? 'expanded' : 'collapsed'}`}>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
