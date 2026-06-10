type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export default function BrandLogo({
  className = '',
  markClassName = 'h-9 w-9',
  textClassName = 'text-xl',
}: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/brand/wasilio-mark.svg" alt="" className={markClassName} />
      <span className={`${textClassName} font-bold tracking-tight text-[#0F5B4A]`}>Wasilio</span>
    </span>
  );
}
