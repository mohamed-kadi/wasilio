import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { mediaDisplayUrl } from '../lib/mediaUrls';

type ProductImageFrameSize = 'sm' | 'lg';

const SIZE_CLASSES: Record<ProductImageFrameSize, string> = {
  sm: 'h-14 w-14',
  lg: 'h-28 w-28',
};

interface ProductImageFrameProps {
  imageUrl?: string;
  alt: string;
  size?: ProductImageFrameSize;
  testId?: string;
}

export default function ProductImageFrame({
  imageUrl,
  alt,
  size = 'sm',
  testId = 'product-thumbnail',
}: ProductImageFrameProps) {
  const resolvedImageUrl = mediaDisplayUrl(imageUrl);
  const [unavailableImageUrl, setUnavailableImageUrl] = useState<string | undefined>();
  const imageUnavailable = Boolean(resolvedImageUrl && unavailableImageUrl === resolvedImageUrl);
  const hasImage = Boolean(resolvedImageUrl) && !imageUnavailable;

  const frameClassName = [
    'flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white',
    SIZE_CLASSES[size],
    hasImage
      ? 'border-gray-200'
      : imageUnavailable
        ? 'border-amber-200 bg-amber-50 text-amber-600'
        : 'border-dashed border-gray-300 text-gray-400',
  ].join(' ');

  if (hasImage) {
    return (
      <span className={frameClassName} data-testid={testId}>
        <img
          src={resolvedImageUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setUnavailableImageUrl(resolvedImageUrl)}
          className="block h-full w-full max-h-full max-w-full object-contain p-1"
        />
      </span>
    );
  }

  return (
    <div className={frameClassName} data-testid={testId}>
      <ImageIcon size={size === 'lg' ? 28 : 22} />
    </div>
  );
}
