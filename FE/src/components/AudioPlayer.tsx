import { useEffect, useRef } from 'react';

interface AudioPlayerProps {
  src?: string | null;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.load();
  }, [src]);

  if (!src) {
    return null;
  }

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        controls
        src={src}
      >
        오디오를 재생하려면 최신 브라우저가 필요합니다.
      </audio>
    </div>
  );
}
