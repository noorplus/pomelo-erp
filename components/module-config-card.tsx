import Link from "next/link";

export function ModuleConfigCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link className="module-card settings-link-card" href={href}>
      <div><span className="module-dot" /><h3>{title}</h3><p>{description}</p></div>
      <span className="module-action">Open configuration →</span>
    </Link>
  );
}
