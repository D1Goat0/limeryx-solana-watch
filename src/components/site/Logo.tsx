import { Link } from "@tanstack/react-router";
import limeryxLogo from "@/assets/limeryx-logo.png";

export function Logo({ size = 34, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-3">
      <img
        src={limeryxLogo}
        alt="Limeryx pixel skull logo"
        width={size}
        height={size}
        style={{ width: size, height: size, imageRendering: "pixelated" }}
        className="border border-border object-cover grayscale contrast-125 transition group-hover:grayscale-0"
      />
      {withText && (
        <span className="pixel-text text-sm text-foreground">
          LIMER<span className="text-primary">YX</span>
        </span>
      )}
    </Link>
  );
}
