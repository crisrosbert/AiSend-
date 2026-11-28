import Image from "next/image";
import { BRAND } from "@/lib/brand";

/**
 * PerfChat logo components, built from the artwork in /public:
 *   perfchat-logo-horizontal.png        mark + wordmark, for light backgrounds
 *   perfchat-logo-horizontal-light.png  same, navy turned white, for dark backgrounds
 *   perfchat-mark.png / -light.png      symbol only
 *
 * `size` is the rendered HEIGHT in px; width follows the artwork ratio.
 * Use `onDark` on dark surfaces (sidebar, footer, login pitch panel).
 */

const LOGO_RATIO = 1109 / 300; // horizontal lockup

type Props = {
  size?: number;
  onDark?: boolean;
  className?: string;
  priority?: boolean;
};

export function Logo({ size = 36, onDark = false, className, priority }: Props) {
  return (
    <Image
      src={onDark ? "/perfchat-logo-horizontal-light.png" : "/perfchat-logo-horizontal.png"}
      alt={BRAND.name}
      width={Math.round(size * LOGO_RATIO)}
      height={size}
      priority={priority}
      className={className}
      style={{ height: size, width: "auto" }}
    />
  );
}

export function LogoMark({ size = 32, onDark = false, className, priority }: Props) {
  return (
    <Image
      src={onDark ? "/perfchat-mark-light.png" : "/perfchat-mark.png"}
      alt={BRAND.name}
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{ height: size, width: "auto", objectFit: "contain" }}
    />
  );
}
