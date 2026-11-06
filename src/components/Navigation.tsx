"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link className="logo" href={href} aria-label="MarketMorph 首頁">
      <span className="logo-mark" aria-hidden="true"><span /><span /><span /></span>
      <span>MarketMorph</span>
    </Link>
  );
}

export default function Navigation() {
  if (usePathname() === "/studio") return null;
  return (
    <header className="navbar">
      <Logo />
      <nav className="nav-links" aria-label="主要導覽">
        <Link href="/#home">首頁</Link>
        <Link href="/#how">使用流程</Link>
      </nav>
    </header>
  );
}
