import { useState, useEffect } from 'react';

interface ProxiedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

export function getProxiedImageUrl(originalUrl: string | null | undefined): string {
  if (!originalUrl || originalUrl.trim() === '') {
    return '';
  }
  
  if (originalUrl.startsWith('/api/proxy-image')) {
    return originalUrl;
  }
  
  if (originalUrl.startsWith('data:')) {
    return originalUrl;
  }
  
  if (originalUrl.startsWith('/') && !originalUrl.startsWith('//')) {
    return originalUrl;
  }
  
  return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
}

export function ProxiedImage({
  src,
  alt,
  className = '',
  fallback,
  onLoad,
  onError,
  style,
  'data-testid': testId
}: ProxiedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src || src.trim() === '') {
      setImageSrc('');
      setIsLoading(false);
      return;
    }
    
    setHasError(false);
    setIsLoading(true);
    setImageSrc(getProxiedImageUrl(src));
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  if (!imageSrc) {
    if (fallback) {
      return (
        <img
          src={fallback}
          alt={alt}
          className={className}
          style={style}
          data-testid={testId}
        />
      );
    }
    return null;
  }

  if (hasError && fallback) {
    return (
      <img
        src={fallback}
        alt={alt}
        className={className}
        style={style}
        data-testid={testId}
      />
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={style}
      onLoad={handleLoad}
      onError={handleError}
      data-testid={testId}
    />
  );
}

export function useProxiedImageUrl(originalUrl: string | null | undefined): string {
  return getProxiedImageUrl(originalUrl);
}
