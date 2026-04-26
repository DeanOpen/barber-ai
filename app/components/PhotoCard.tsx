"use client";

import { CheckCircleFilled } from "@ant-design/icons";
import { useState } from "react";

type Props = {
  imageUrl?: string | null;
  fallbackEmoji?: string;
  title: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
};

export default function PhotoCard({
  imageUrl,
  fallbackEmoji,
  title,
  subtitle,
  selected,
  onSelect,
}: Props) {
  const [errored, setErrored] = useState(false);
  const showImage = imageUrl && !errored;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`photo-card ${selected ? "is-selected" : ""}`}
      aria-pressed={selected}
    >
      <div className="photo-card-media">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl!}
            alt={title}
            loading="lazy"
            onError={() => setErrored(true)}
          />
        ) : (
          <div className="photo-card-fallback">
            <span aria-hidden>{fallbackEmoji ?? "✨"}</span>
          </div>
        )}
        <div className="photo-card-shade" />
        {selected && (
          <div className="photo-card-check">
            <CheckCircleFilled />
          </div>
        )}
      </div>
      <div className="photo-card-body">
        <div className="photo-card-title">{title}</div>
        {subtitle && <div className="photo-card-sub">{subtitle}</div>}
      </div>
    </button>
  );
}
