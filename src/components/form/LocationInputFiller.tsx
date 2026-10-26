import React, { useState, useEffect, useCallback } from 'react';
import type { FormFieldISO } from '../../types';
import { parseGoogleMapsUrl, formatDMS } from '../../utils/formUtils';
import { MapPin, ExternalLink, Loader2, X } from 'lucide-react';
import { MiniMapCanvas } from './MiniMapCanvas';

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
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [resolvedCoords, setResolvedCoords] = useState<{
    lat?: number;
    lng?: number;
    mapsUrl?: string;
    dmsText?: string;
    decimalText?: string;
  } | null>(null);

  // Sync internal input value with prop
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Parse location data directly on client side
  const parsedLocation = parseGoogleMapsUrl(value);

  // Auto-resolve coordinates for short links (e.g. maps.app.goo.gl) on mount or value change
  useEffect(() => {
    if (!value || typeof value !== 'string' || !value.trim()) {
      setResolvedCoords(null);
      return;
    }

    const trimmed = value.trim();
    const client = parseGoogleMapsUrl(trimmed);
    if (client && client.lat !== undefined && client.lng !== undefined) {
      setResolvedCoords(client);
    } else if (
      trimmed.includes('maps.app.goo.gl') ||
      trimmed.includes('goo.gl/maps') ||
      (trimmed.startsWith('http') && trimmed.includes('google.com/maps'))
    ) {
      setIsResolving(true);
      fetch(`/api/utils/unshorten-map?url=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.lat != null && data.lng != null) {
            setResolvedCoords({
              lat: data.lat,
              lng: data.lng,
              mapsUrl: data.mapsUrl || `https://www.google.com/maps?q=${data.lat},${data.lng}`,
              dmsText: formatDMS(data.lat, data.lng),
              decimalText: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`
            });
          }
        })
        .catch((err) => console.warn('Failed to resolve map shortlink:', err))
        .finally(() => setIsResolving(false));
    }
  }, [value]);

  // Resolves a URL via backend proxy when user submits or blurs
  const handleResolveAndSave = useCallback(async (rawText: string) => {
    const trimmed = rawText.trim();
    setErrorMessage(null);

    if (!trimmed) {
      onChange('');
      setResolvedCoords(null);
      return;
    }

    // Try client-side parsing first
    const clientParsed = parseGoogleMapsUrl(trimmed);
    if (clientParsed && clientParsed.lat !== undefined && clientParsed.lng !== undefined) {
      setResolvedCoords(clientParsed);
      onChange(trimmed);
      return;
    }

    // Call backend unshorten proxy
    if (
      trimmed.includes('maps.app.goo.gl') ||
      trimmed.includes('goo.gl/maps') ||
      (trimmed.startsWith('http') && trimmed.includes('google.com/maps'))
    ) {
      setIsResolving(true);
      try {
        const res = await fetch(`/api/utils/unshorten-map?url=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.lat != null && data.lng != null) {
            setResolvedCoords({
              lat: data.lat,
              lng: data.lng,
              mapsUrl: data.mapsUrl || `https://www.google.com/maps?q=${data.lat},${data.lng}`,
              dmsText: formatDMS(data.lat, data.lng),
              decimalText: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`
            });
          }
        }
        onChange(trimmed);
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
        setResolvedCoords({
          lat,
          lng,
          mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
          dmsText: formatDMS(lat, lng),
          decimalText: coordsStr
        });
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

  // Compute effective coordinates and texts
  const effectiveLat = parsedLocation?.lat ?? resolvedCoords?.lat;
  const effectiveLng = parsedLocation?.lng ?? resolvedCoords?.lng;
  const effectiveMapsUrl = parsedLocation?.mapsUrl || resolvedCoords?.mapsUrl || (value.startsWith('http') ? value : (effectiveLat != null && effectiveLng != null ? `https://www.google.com/maps?q=${effectiveLat},${effectiveLng}` : ''));
  const effectiveDmsText = parsedLocation?.dmsText || resolvedCoords?.dmsText || (effectiveLat != null && effectiveLng != null ? formatDMS(effectiveLat, effectiveLng) : undefined);
  const effectiveDecimalText = parsedLocation?.decimalText || resolvedCoords?.decimalText || (effectiveLat != null && effectiveLng != null ? `${effectiveLat.toFixed(6)}, ${effectiveLng.toFixed(6)}` : undefined);
  const coordDisplayText = effectiveDmsText || effectiveDecimalText;
  const shouldShowMiniMap = field.showMiniMap !== false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', flex: 1, height: '100%' }}>
      {/* Smart Location Bar (Phương án 2: Gộp input & toạ độ làm 1) */}
      {coordDisplayText && !isEditingRaw ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '36px',
          padding: '0 0.5rem 0 0.65rem',
          background: disabled ? '#f8fafc' : '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          boxSizing: 'border-box',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
            <MapPin size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {coordDisplayText}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {effectiveMapsUrl && (
              <a
                href={effectiveMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  color: 'var(--primary)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: '#f0fdfa',
                  border: '1px solid rgba(13, 148, 136, 0.2)'
                }}
                title="Mở trên Google Maps"
              >
                <ExternalLink size={11} /> <span>Mở Maps</span>
              </a>
            )}

            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={handleGetGPS}
                  disabled={isLocating}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid var(--primary)',
                    background: '#f0fdfa',
                    color: 'var(--primary)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: isLocating ? 'wait' : 'pointer'
                  }}
                  title="Lấy lại GPS vị trí hiện tại"
                >
                  {isLocating ? <Loader2 size={11} className="animate-spin" /> : <><MapPin size={11} /> GPS</>}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingRaw(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 4px',
                    borderRadius: '3px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#64748b',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                  title="Đổi toạ độ / nhập lại link"
                >
                  <X size={11} />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '8px', color: '#94a3b8', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
              <MapPin size={13} />
            </span>
            <input
              type="text"
              disabled={disabled}
              value={inputValue}
              autoFocus={isEditingRaw}
              placeholder={field.placeholder || 'Dán link Google Maps hoặc toạ độ...'}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={() => {
                handleResolveAndSave(inputValue);
                if (coordDisplayText) setIsEditingRaw(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleResolveAndSave(inputValue);
                  if (coordDisplayText) setIsEditingRaw(false);
                } else if (e.key === 'Escape' && coordDisplayText) {
                  setInputValue(value || '');
                  setIsEditingRaw(false);
                }
              }}
              style={{
                width: '100%',
                height: '36px',
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
                height: '36px',
                padding: '0 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: '1px solid var(--primary)',
                background: '#f0fdfa',
                color: 'var(--primary)',
                cursor: isLocating ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxSizing: 'border-box'
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

          {isEditingRaw && coordDisplayText && (
            <button
              type="button"
              onClick={() => {
                setInputValue(value || '');
                setIsEditingRaw(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '36px',
                padding: '0 0.5rem',
                fontSize: '0.72rem',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#64748b',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
              title="Huỷ chỉnh sửa"
            >
              Huỷ
            </button>
          )}
        </div>
      )}

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

      {/* Sơ đồ thu nhỏ Mini Map Canvas phẳng (Phương án 4: Siêu nhẹ, không scroll trap, in PDF 100%) */}
      {shouldShowMiniMap && effectiveLat != null && effectiveLng != null && (
        <MiniMapCanvas
          lat={effectiveLat}
          lng={effectiveLng}
          zoom={15}
          mapType={field.mapType || 'roadmap'}
          style={{ flex: 1, minHeight: '75px', width: '100%' }}
          onClick={() => {
            if (effectiveMapsUrl) {
              window.open(effectiveMapsUrl, '_blank', 'noopener,noreferrer');
            }
          }}
        />
      )}
    </div>
  );
};
