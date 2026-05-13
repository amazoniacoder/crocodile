import React from 'react';

interface YouTubeEmbedProps {
  videoId: string;
  open: boolean;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoId, open }) => {
  if (!open) return null;

  return (
    <div className="yt-embed__wrap">
      <iframe
        className="yt-embed__iframe"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        title="YouTube video"
      />
    </div>
  );
};
