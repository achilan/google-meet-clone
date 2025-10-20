import React, { useEffect } from "react";
import Card from "../../Shared/Card/Card.component";
import { faMicrophoneSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./Participant.css";

export const Participant = (props) => {
  const {
    curentIndex,
    currentParticipant,
    hideVideo,
    videoRef,
    showAvatar,
    currentUser,
    background,
    canvasRef
  } = props;
  
  // Monitor video stream changes for current user (especially important on mobile)
  useEffect(() => {
    if (currentUser && videoRef && videoRef.current && currentParticipant) {
      const videoElement = videoRef.current;
      
      const handleLoadedMetadata = () => {
        console.log('Video metadata loaded, video ready');
      };
      
      const handleCanPlay = () => {
        console.log('Video can play');
      };
      
      const handleError = (e) => {
        console.error('Video error:', e);
      };
      
      // Add event listeners
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('error', handleError);
      
      // Force video to play if it has a stream but isn't playing
      if (videoElement.srcObject && videoElement.paused) {
        videoElement.play().catch(e => console.log('Auto-play prevented:', e));
      }
      
      return () => {
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
      };
    }
  }, [currentUser, videoRef, currentParticipant?.video]);
  
  if (!currentParticipant) return <></>;
  
  // For current user, check if video is disabled - simplified logic
  const isVideoDisabled = currentUser && !currentParticipant.video;
  
  // Debug log for mobile troubleshooting
  console.log('Participant debug:', {
    currentUser,
    participantName: currentParticipant.name,
    video: currentParticipant.video,
    hasVideoRef: !!videoRef,
    hasSrcObject: videoRef && videoRef.current ? !!videoRef.current.srcObject : false,
    isVideoDisabled
  });
  
  const randomBackground = () => {
    const classes = ["background1", "background1", "background1"];
    const random = Math.floor(Math.random() * 3);
    return classes[random];
  }
  return (
    <div className={`participant ${hideVideo ? "hide" : ""}`}>
      <Card>
        <video
          ref={videoRef}
          className={`video ${isVideoDisabled ? 'video-disabled' : ''}`}
          id={`participantVideo${curentIndex}`}
          autoPlay
          playsInline
          muted={currentUser} // Mute own video to prevent feedback
          controls={false}
          onLoadedMetadata={() => {
            console.log('Video element loaded metadata for:', currentParticipant.name);
          }}
          onError={(e) => {
            console.error('Video element error for:', currentParticipant.name, e);
          }}
        ></video>
        {isVideoDisabled && (
          <div className="video-placeholder">
            <div className="video-placeholder-content">
              <span className="video-off-icon">📷</span>
              <span className="video-off-text">Cámara desactivada</span>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`canvas ${isVideoDisabled ? 'canvas-disabled' : ''}`}
          id={`participantCanvas${curentIndex}`}
        ></canvas>
        <img 
          className="none-img"
          id={`imageCanvas${curentIndex}`}
        />
        {!currentParticipant.audio && (
          <FontAwesomeIcon
            className="muted"
            icon={faMicrophoneSlash}
            title="Muted"
          />
        )}
        {showAvatar && (
          <div
            style={{ background: currentParticipant.avatarColor }}
            className="avatar"
          >
            {currentParticipant.name[0]}
          </div>
        )}
        <div className="name">
          {currentParticipant.name}
          {currentUser ? "(You)" : ""}
        </div>
      </Card>
    </div>
  );
};
