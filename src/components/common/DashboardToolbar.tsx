import React from 'react';
import { Search, X } from 'lucide-react';

export interface DashboardToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  leading?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  embedded?: boolean;
  bare?: boolean;
  searchWidth?: string;
  hideSearch?: boolean;
}

export default function DashboardToolbar({
  searchQuery,
  onSearchChange,
  placeholder = 'Search...',
  leading,
  filters,
  actions,
  embedded = false,
  bare = false,
  searchWidth,
  hideSearch = false
}: DashboardToolbarProps) {
  return (
    <div
      className={embedded || bare ? undefined : 'paper-card'}
      style={{
        padding: bare ? 0 : '0.75rem 1rem',
        minHeight: bare ? '36px' : '60px',
        boxSizing: 'border-box',
        display: 'flex',
        gap: bare ? '0.6rem' : '0.75rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: bare ? 'transparent' : embedded ? 'var(--neutral-card)' : undefined,
        borderBottom: embedded && !bare ? '1px solid var(--neutral-border)' : undefined,
        marginBottom: embedded && !bare ? 0 : '0.85rem'
      }}
    >
      <div style={{ display: 'flex', gap: bare ? '0.6rem' : '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap', alignItems: 'center' }}>
        {leading}

        {!hideSearch && (
          <div style={{ position: 'relative', width: searchWidth || (bare ? '260px' : '360px'), maxWidth: '100%', flexShrink: 0 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.7rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                height: '36px',
                padding: '0 2rem 0 2.15rem',
                fontSize: '0.82rem',
                border: '1px solid var(--neutral-border)',
                borderRadius: bare ? '8px' : '6px',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
                background: '#fff',
                transition: 'border-color 0.15s ease'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                  borderRadius: '50%'
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Filters slot */}
        {filters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: bare ? '0.5rem' : '0.75rem', flexWrap: 'wrap' }}>
            {filters}
          </div>
        )}
      </div>

      {/* Actions slot */}
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: 'auto' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
