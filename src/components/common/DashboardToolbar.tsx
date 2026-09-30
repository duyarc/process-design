import React from 'react';
import { Search, X } from 'lucide-react';

export interface DashboardToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function DashboardToolbar({
  searchQuery,
  onSearchChange,
  placeholder = 'Search...',
  filters,
  actions
}: DashboardToolbarProps) {
  return (
    <div 
      className="paper-card" 
      style={{ 
        padding: '0.625rem 1rem', 
        minHeight: '56px',
        boxSizing: 'border-box',
        display: 'flex', 
        gap: '0.75rem', 
        flexWrap: 'wrap', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '1.25rem' 
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search Input Box — Fixed 360px width across all 4 tabs */}
        <div style={{ position: 'relative', width: '360px', maxWidth: '100%', flexShrink: 0 }}>
          <Search 
            size={16} 
            style={{ 
              position: 'absolute', 
              left: '0.75rem', 
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
              padding: '0 2rem 0 2.25rem', 
              fontSize: '0.85rem', 
              border: '1px solid var(--neutral-border)', 
              borderRadius: '6px', 
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

        {/* Filters slot */}
        {filters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
