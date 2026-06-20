type ClientAvatarProps = {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
  /** contain fits full logos inside the box; cover fills circular profile photos. */
  objectFit?: "contain" | "cover";
};

export function ClientAvatar({
  name,
  logoUrl,
  size = 36,
  className = "",
  objectFit = "contain",
}: ClientAvatarProps) {
  const style = { width: size, height: size };
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  if (logoUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10 ${className}`}
        style={style}
      >
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          className={`h-full w-full ${objectFit === "cover" ? "object-cover" : "object-contain p-1"}`}
        />
      </span>
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
