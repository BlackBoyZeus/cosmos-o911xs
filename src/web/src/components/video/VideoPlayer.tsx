import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box, IconButton, Slider, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import SettingsIcon from '@mui/icons-material/Settings';
import Loading from '../common/Loading';
import { formatTimestamp } from '../../utils/formatters';

// Video quality settings type
export type VideoQuality = 'auto' | '720p' | '1080p' | '1440p';

// Video error type
export interface VideoError {
  code: string;
  message: string;
  recoverable: boolean;
}

// Component props interface
export interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  width?: number | string;
  height?: number | string;
  onError?: (error: VideoError) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  quality?: VideoQuality;
  initialVolume?: number;
  showBuffering?: boolean;
  ariaLabel?: string;
  onQualityChange?: (quality: VideoQuality) => void;
  onTimeUpdate?: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
}

// Custom hook for video controls
const useVideoControls = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);

  // Play/Pause control
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying, videoRef]);

  // Volume control
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, [videoRef]);

  // Seek control
  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, [videoRef]);

  // Fullscreen control
  const toggleFullscreen = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (!isFullscreen) {
        await videoRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, [isFullscreen, videoRef]);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    buffering,
    controls: {
      togglePlay,
      handleVolumeChange,
      handleSeek,
      toggleFullscreen,
    },
    setters: {
      setIsPlaying,
      setCurrentTime,
      setDuration,
      setBuffering,
    }
  };
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  autoPlay = false,
  loop = false,
  controls = true,
  width = '100%',
  height = 'auto',
  onError,
  onLoadStart,
  onLoadEnd,
  quality = 'auto',
  initialVolume = 1,
  showBuffering = true,
  ariaLabel,
  onQualityChange,
  onTimeUpdate,
  onVolumeChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    buffering,
    controls: videoControls,
    setters
  } = useVideoControls(videoRef);

  // Initialize video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = initialVolume;
    }
  }, [initialVolume]);

  // Event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers = {
      loadstart: () => {
        setters.setBuffering(true);
        onLoadStart?.();
      },
      loadeddata: () => {
        setters.setBuffering(false);
        setters.setDuration(video.duration);
        onLoadEnd?.();
      },
      timeupdate: () => {
        setters.setCurrentTime(video.currentTime);
        onTimeUpdate?.(video.currentTime);
      },
      play: () => setters.setIsPlaying(true),
      pause: () => setters.setIsPlaying(false),
      waiting: () => setters.setBuffering(true),
      playing: () => setters.setBuffering(false),
      error: () => {
        const error: VideoError = {
          code: 'VIDEO_ERROR',
          message: 'An error occurred while playing the video',
          recoverable: true
        };
        onError?.(error);
      }
    };

    // Add event listeners
    Object.entries(handlers).forEach(([event, handler]) => {
      video.addEventListener(event, handler);
    });

    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        video.removeEventListener(event, handler);
      });
    };
  }, [onLoadStart, onLoadEnd, onTimeUpdate, onError, setters]);

  return (
    <Box sx={{ position: 'relative', width, height }}>
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        aria-label={ariaLabel || 'Video player'}
        style={{ width: '100%', height: '100%' }}
      />

      {showBuffering && buffering && (
        <Loading
          size="large"
          message="Loading video..."
          color="primary"
        />
      )}

      {controls && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 2,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <IconButton
            onClick={videoControls.togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            sx={{ color: 'white' }}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>

          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="caption" sx={{ color: 'white' }}>
              {formatTimestamp(currentTime * 1000)}
            </Typography>

            <Slider
              value={currentTime}
              max={duration}
              onChange={(_, value) => videoControls.handleSeek(value as number)}
              aria-label="Video progress"
              sx={{ color: 'white' }}
            />

            <Typography variant="caption" sx={{ color: 'white' }}>
              {formatTimestamp(duration * 1000)}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => videoControls.handleVolumeChange(isMuted ? volume : 0)}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              sx={{ color: 'white' }}
            >
              {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>

            <Slider
              value={volume}
              max={1}
              step={0.1}
              onChange={(_, value) => {
                videoControls.handleVolumeChange(value as number);
                onVolumeChange?.(value as number);
              }}
              aria-label="Volume"
              sx={{ width: 100, color: 'white' }}
            />

            <IconButton
              onClick={videoControls.toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              sx={{ color: 'white' }}
            >
              <FullscreenIcon />
            </IconButton>

            {onQualityChange && (
              <IconButton
                onClick={() => onQualityChange(quality)}
                aria-label="Video quality settings"
                sx={{ color: 'white' }}
              >
                <SettingsIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default VideoPlayer;