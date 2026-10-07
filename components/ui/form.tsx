import type { FormHTMLAttributes, ReactNode } from "react";

export type FormLayout = "grid" | "inline" | "plain";

export function Form({
  children,
  className,
  layout = "grid",
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
  layout?: FormLayout;
}) {
  const classes = [
    "ui-form",
    layout === "grid" ? "ui-form-grid" : null,
    layout === "inline" ? "ui-form-inline" : null,
    className,
  ].filter(Boolean).join(" ");

  return <form className={classes} {...props}>{children}</form>;
}
