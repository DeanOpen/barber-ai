import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "80px 24px", textAlign: "center", color: "var(--fg)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Page not found
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        That page must have walked out without a haircut.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          background: "var(--accent)",
          color: "var(--on-accent)",
          padding: "10px 18px",
          borderRadius: 10,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Back to the chair
      </Link>
    </div>
  );
}
