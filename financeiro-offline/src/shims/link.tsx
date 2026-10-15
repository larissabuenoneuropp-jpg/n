import { forwardRef } from "react";

/** Substitui next/link: links viram "#/caminho" (navegação dentro do próprio arquivo). */
const Link = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }>(function Link({ href, prefetch: _p, ...rest }, ref) {
  const to = href.startsWith("/") ? `#${href}` : href;
  return <a ref={ref} href={to} {...rest} />;
});
export default Link;
