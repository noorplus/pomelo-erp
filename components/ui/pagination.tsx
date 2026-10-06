"use client";

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const safeCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safeCount);
  return (
    <nav aria-label="Pagination" className="ui-pagination">
      <button className="button" type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>Previous</button>
      <span>Page {safePage} of {safeCount}</span>
      <button className="button" type="button" disabled={safePage >= safeCount} onClick={() => onPageChange(safePage + 1)}>Next</button>
    </nav>
  );
}
