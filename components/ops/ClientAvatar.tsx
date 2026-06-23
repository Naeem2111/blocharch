import { avatarInitials } from "@/lib/avatar-initials";

type ClientAvatarProps = {
  name: string;
  logoUrl?: string | null;
  /** Circle background when logo is transparent or for initials fallback. */
  backgroundColor?: string | null;
  size?: number;
  className?: string;
  /** contain fits full logos inside the box; cover fills circular profile photos. */
  objectFit?: "contain" | "cover";
};

export function ClientAvatar({
  name,
  logoUrl,
  backgroundColor,
  size = 36,
  className = "",
  objectFit = "contain",
}: ClientAvatarProps) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    ...(backgroundColor ? { backgroundColor } : {}),
  };
  const initials = avatarInitials(name);
  const fontSize = size <= 32 ? "0.65rem" : size <= 40 ? "0.7rem" : "0.75rem";

  if (logoUrl) {
    return (
      <span
        className={`avatar-circle inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10 ${className}`}
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
      className={`avatar-circle flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-semibold text-slate-300 ring-1 ring-white/10 ${className}`}
      style={{ ...style, fontSize }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
