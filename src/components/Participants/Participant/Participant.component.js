import React, { useEffect } from "react";
import Card from "../../Shared/Card/Card.component";
import { MicOff, VideoOff } from "../../Shared/icons";
import "./Participant.css";

export const Participant = (props) => {
  const {
    curentIndex,
    currentParticipant,
    videoRef,
    showAvatar,
    currentUser,
  } = props;

  // En móvil el <video> a veces queda en pausa aunque tenga stream: forzar play.
  useEffect(() => {
    if (currentUser && videoRef && videoRef.current) {
      const videoElement = videoRef.current;
      if (videoElement.srcObject && videoElement.paused) {
        videoElement.play().catch(() => {});
      }
    }
  }, [currentUser, videoRef, currentParticipant?.video]);

  if (!currentParticipant) return <></>;

  // Cámara apagada (solo aplica al usuario actual, que controla su propio track).
  const isVideoDisabled = currentUser && !currentParticipant.video;

  return (
    <div className="participant">
      <Card>
        <video
          ref={videoRef}
          className={`video ${isVideoDisabled ? "video-disabled" : ""}`}
          id={`participantVideo${curentIndex}`}
          autoPlay
          playsInline
          muted={currentUser}
          controls={false}
        ></video>
        {isVideoDisabled && (
          <div className="video-placeholder">
            <div className="video-placeholder-content">
              <span className="video-off-icon">
                <VideoOff size={44} strokeWidth={1.5} />
              </span>
              <span className="video-off-text">Cámara desactivada</span>
            </div>
          </div>
        )}
        {!currentParticipant.audio && (
          <div className="muted" title="Silenciado">
            <MicOff size={13} strokeWidth={2.5} />
          </div>
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
          {currentUser ? " (Tú)" : ""}
        </div>
      </Card>
    </div>
  );
};
