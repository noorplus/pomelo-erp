import Link from "next/link";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="ui-breadcrumbs">
      {items.map((item, index) => (
        <span className="ui-breadcrumb-item" key={`${item.label}-${index}`}>
          {index ? <span aria-hidden="true">/</span> : null}
          {item.href && index < items.length - 1 ? <Link href={item.href}>{item.label}</Link> : <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
