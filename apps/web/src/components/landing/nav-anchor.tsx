"use client";

import { usePathname, useRouter } from "next/navigation";
import { forwardRef, useEffect } from "react";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";

const STORAGE_KEY = "spire:scroll-target";

function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type NavAnchorProps = ComponentPropsWithoutRef<"a"> & {
  section: string;
};

export const NavAnchor = forwardRef<HTMLAnchorElement, NavAnchorProps>(
  function NavAnchor({ section, onClick, ...props }, ref) {
    const pathname = usePathname();
    const router = useRouter();

    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();

      if (pathname === "/") {
        scrollToSection(section);
        return;
      }

      try {
        sessionStorage.setItem(STORAGE_KEY, section);
      } catch {
        router.push(`/#${section}`);
        return;
      }
      router.push("/");
    }

    return (
      <a ref={ref} {...props} href={`/#${section}`} onClick={handleClick} />
    );
  },
);

export function PendingSectionScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }
    let target: string | null = null;
    try {
      target = sessionStorage.getItem(STORAGE_KEY);
      if (target) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      target = null;
    }
    if (target) {
      requestAnimationFrame(() => scrollToSection(target));
    }
  }, [pathname]);

  return null;
}
