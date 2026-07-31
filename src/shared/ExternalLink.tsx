import { openUrl } from "@tauri-apps/plugin-opener";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> {
  href: string;
  children: ReactNode;
}

/**
 * A plain `<a href target="_blank">` doesn't reliably hand off to the OS
 * browser inside a Tauri webview - clicking one can just silently do
 * nothing, since the webview isn't a real browser tab with normal
 * "open in new tab" semantics. This opens the URL via the opener plugin's
 * JS API instead (needs `"opener:default"` in capabilities/default.json),
 * while still rendering a real `<a href>` underneath so right-click
 * "copy link address", hover previews, and screen readers keep working
 * exactly as expected - only the click behavior is intercepted.
 */
export function ExternalLink({ href, onClick, children, ...rest }: Props) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    onClick?.(e);
    void openUrl(href);
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
