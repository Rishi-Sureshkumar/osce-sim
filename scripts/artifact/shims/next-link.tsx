import type { AnchorHTMLAttributes } from "react";

/** Root-relative hrefs are caught by the document click handler in main.tsx. */
export default function Link({ href, prefetch: _p, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) {
  return <a href={href} {...rest} />;
}
