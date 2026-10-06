"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section aria-live="assertive" className="page-state">
      <p className="eyebrow">Application error</p>
      <h1>We could not load this workspace</h1>
      <p className="lede">
        Something went wrong while loading the application. You can retry or
        return to the sign-in page.
      </p>
      <div className="actions">
        <button className="button primary" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="button" href="/login">
          Sign in again
        </Link>
      </div>
    </section>
  );
}
