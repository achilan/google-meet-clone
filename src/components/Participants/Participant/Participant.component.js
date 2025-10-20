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
  
  if (!currentParticipant) return <></>;
  
  // For current user, check if video is disabled OR if video element has no stream
  const isVideoDisabled = currentUser && (!currentParticipant.video || 
    (videoRef && videoRef.current && !videoRef.current.srcObject));
  
  // Debug log for mobile troubleshooting
  if (currentUser) {
    console.log('Participant debug:', {
      video: currentParticipant.video,
      hasVideoRef: !!videoRef,
      hasSrcObject: videoRef && videoRef.current ? !!videoRef.current.srcObject : false,
      isVideoDisabled
    });
  }
  
  // Monitor video stream changes for current user (especially important on mobile)
  useEffect(() => {
    if (currentUser && videoRef && videoRef.current) {
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
  }, [currentUser, videoRef, currentParticipant.video]);
  
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
          style={{
            display: isVideoDisabled ? 'none' : 'block'
          }}
          onLoadedMetadata={() => {
            if (currentUser) console.log('Video element loaded metadata');
          }}
          onError={(e) => {
            if (currentUser) console.error('Video element error:', e);
          }}
        ></video>
        {isVideoDisabled && (
          <div className="video-placeholder">
            <div className="video-placeholder-content">
              <span className="video-off-icon">📷</span>
              <span className="video-off-text">
                {currentParticipant.video && (!videoRef || !videoRef.current || !videoRef.current.srcObject) 
                  ? "Conectando cámara..." 
                  : "Cámara desactivada"
                }
              </span>
              {currentParticipant.video && (!videoRef || !videoRef.current || !videoRef.current.srcObject) && (
                <span className="video-off-subtext">
                  Verificando dispositivos...
                </span>
              )}
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`canvas ${isVideoDisabled ? 'canvas-disabled' : ''}`}
          id={`participantCanvas${curentIndex}`}
          style={{
            display: isVideoDisabled ? 'none' : 'block'
          }}
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
