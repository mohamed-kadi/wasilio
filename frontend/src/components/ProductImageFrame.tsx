import { ImageIcon } from 'lucide-react';

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
  const frameClassName = [
    'flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white',
    SIZE_CLASSES[size],
    imageUrl ? 'border-gray-200' : 'border-dashed border-gray-300 text-gray-400',
  ].join(' ');

  if (imageUrl) {
    return (
      <span className={frameClassName} data-testid={testId}>
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-contain p-1"
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
