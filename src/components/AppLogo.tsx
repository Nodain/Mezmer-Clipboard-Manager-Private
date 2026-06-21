/** Mezmerize app mark — used in empty states, about, modals, and inline actions. */
export const APP_LOGO_SRC = "/mezmerize-logo.png";

export function AppLogo({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={APP_LOGO_SRC}
      alt=""
      className={className}
      draggable={false}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
