import React, { useState, useEffect, useCallback } from 'react';
import type { FormFieldISO } from '../../types';
import { parseGoogleMapsUrl } from '../../utils/formUtils';
import { MapPin, ExternalLink, Loader2 } from 'lucide-react';

interface LocationInputFillerProps {
  field: FormFieldISO;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export const LocationInputFiller: React.FC<LocationInputFillerProps> = ({
  field,
  value,
  onChange,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isResolving, setIsResolving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync internal input value with prop
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Parse location data from current value
  const parsedLocation = parseGoogleMapsUrl(value);

  // Resolves a URL (especially maps.app.goo.gl) via backend proxy if needed
  const handleResolveAndSave = useCallback(async (rawText: string) => {
    const trimmed = rawText.trim();
    setErrorMessage(null);

    if (!trimmed) {
      onChange('');
      return;
    }

    // Try client-side parsing first
    const clientParsed = parseGoogleMapsUrl(trimmed);
    if (clientParsed && clientParsed.lat !== undefined && clientParsed.lng !== undefined) {
      onChange(trimmed);
      return;
    }

    // If it's a shortlink or general URL, call backend unshorten proxy
    if (trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps') || (trimmed.startsWith('http') && trimmed.includes('google.com/maps'))) {
      setIsResolving(true);
      try {
        const res = await fetch(`/api/utils/unshorten-map?url=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.mapsUrl) {
            onChange(trimmed);
          } else {
            onChange(trimmed);
          }
        } else {
          onChange(trimmed);
        }
      } catch (err) {
        console.warn('Failed to unshorten map link:', err);
        onChange(trimmed);
      } finally {
        setIsResolving(false);
      }
    } else {
      onChange(trimmed);
    }
  }, [onChange]);

  // HTML5 GPS Geolocation handler
  const handleGetGPS = () => {
    if (disabled || isLocating) return;
    if (!navigator.geolocation) {
      setErrorMessage('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setInputValue(coordsStr);
        handleResolveAndSave(coordsStr);
      },
      (err) => {
        setIsLocating(false);
        let msg = 'Không thể lấy toạ độ GPS.';
        if (err.code === 1) msg = 'Vui lòng cho phép quyền truy cập vị trí trên trình duyệt.';
        else if (err.code === 2) msg = 'Vị trí hiện tại không khả dụng.';
        else if (err.code === 3) msg = 'Quá thời gian lấy vị trí GPS.';
        setErrorMessage(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginTop: '2px' }}>
      {/* Input bar with GPS 1-touch button */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '8px', color: '#94a3b8', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <MapPin size={13} />
          </span>
          <input
            type="text"
            disabled={disabled}
            value={inputValue}
            placeholder={field.placeholder || 'Dán link Google Maps hoặc toạ độ...'}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
            onBlur={() => handleResolveAndSave(inputValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleResolveAndSave(inputValue);
              }
            }}
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem 0.35rem 1.7rem',
              fontSize: '0.78rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: disabled ? '#f1f5f9' : '#ffffff',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {!disabled && (
          <button
            type="button"
            disabled={isLocating}
            onClick={handleGetGPS}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              borderRadius: '4px',
              border: '1px solid var(--primary)',
              background: '#f0fdfa',
              color: 'var(--primary)',
              cursor: isLocating ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            title="Lấy toạ độ GPS thiết bị hiện tại"
          >
            {isLocating ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Đang định vị...
              </>
            ) : (
              <>
                <MapPin size={12} /> GPS
              </>
            )}
          </button>
        )}
      </div>

      {isResolving && (
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Loader2 size={11} className="animate-spin" /> Đang xác định toạ độ Google Maps...
        </span>
      )}

      {errorMessage && (
        <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>
          ⚠️ {errorMessage}
        </span>
      )}

      {/* Thẻ Vị trí Tinh gọn (Option A — Siêu nhẹ, Không Iframe) */}
      {parsedLocation && parsedLocation.mapsUrl && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.35rem 0.65rem',
          background: '#f8fafc',
          borderLeft: '3px solid var(--primary)',
          borderRadius: '3px',
          marginTop: '2px',
          fontSize: '0.78rem',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <span style={{ color: 'var(--primary)', flexShrink: 0, fontSize: '0.82rem' }}>📍</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {parsedLocation.dmsText || parsedLocation.decimalText || 'Đã xác định vị trí'}
            </span>
          </div>
          <a
            href={parsedLocation.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              color: 'var(--primary)',
              fontWeight: 600,
              fontSize: '0.72rem',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Mở vị trí trên Google Maps"
          >
            <ExternalLink size={11} /> Mở Maps
          </a>
        </div>
      )}
    </div>
  );
};
