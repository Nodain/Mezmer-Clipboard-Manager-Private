export function ClipboardEmpty({
  title,
  hint,
  className = "",
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`clipboard-empty ${className}`.trim()}>
      <div className="clipboard-empty-icon" aria-hidden="true">
        <img
          src="/mezmer-mark.png"
          alt=""
          className="clipboard-empty-mark"
          draggable={false}
        />
      </div>
      <p className="clipboard-empty-title">{title}</p>
      {hint ? <p className="clipboard-empty-hint">{hint}</p> : null}
    </div>
  );
}
