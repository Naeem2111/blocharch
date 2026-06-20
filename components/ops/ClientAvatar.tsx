type ClientAvatarProps = {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
};

export function ClientAvatar({ name, logoUrl, size = 36, className = "" }: ClientAvatarProps) {
  const style = { width: size, height: size };
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ring-1 ring-white/10 ${className}`}
        style={style}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-slate-300 ring-1 ring-white/10 ${className}`}
      style={style}
      aria-hidden
    >
      {initial}
    </span>
  );
}
