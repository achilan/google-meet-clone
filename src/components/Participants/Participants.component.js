import React, { useEffect, useRef, useState } from "react";
import "./Participants.css";
import { connect } from "react-redux";
import { Participant } from "./Participant/Participant.component";

const Participants = (props) => {
  const videoRef = useRef(null);
  const participantKey = Object.keys(props.participants);

  // Estilo WhatsApp: por defecto el remoto va en grande y el usuario actual en
  // el recuadro flotante (PiP). `swapped` invierte quién ocupa la vista principal.
  const [swapped, setSwapped] = useState(false);

  // Mostrar el stream local (crudo o ya procesado con fondo) en el video propio.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = props.stream;
      videoRef.current.muted = true;
    }
  }, [props.currentUser, props.stream]);

  const currentUser = props.currentUser
    ? Object.values(props.currentUser)[0]
    : null;

  const screenPresenter = participantKey.find(
    (element) => props.participants[element].screen
  );

  const currentUserKey =
    participantKey.find((key) => props.participants[key].currentUser) ||
    participantKey[0];
  const remoteKeys = participantKey.filter(
    (key) => !props.participants[key].currentUser
  );
  const hasRemote = remoteKeys.length > 0;

  // ¿Quién ocupa la vista principal? Quien comparte pantalla tiene prioridad;
  // si no, por defecto el remoto va en grande y `swapped` permite invertirlo.
  let remoteIsMain;
  if (screenPresenter) {
    remoteIsMain = screenPresenter !== currentUserKey;
  } else {
    remoteIsMain = !swapped;
  }
  if (!hasRemote) remoteIsMain = false;

  const canSwap = hasRemote && !screenPresenter;
  const toggleSwap = () => {
    if (canSwap) setSwapped((prev) => !prev);
  };

  // Participante(s) remoto(s): conectar el stream entrante al elemento <video>.
  const remoteParticipants = participantKey.map((element) => {
    const currentParticipant = props.participants[element];
    if (currentParticipant.currentUser) return null;

    const pc = currentParticipant.peerConnection;
    const remoteStream = new MediaStream();
    const currentIndex = element;

    if (pc) {
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
        setTimeout(() => {
          const videoElement = document.getElementById(
            `participantVideo${currentIndex}`
          );
          if (videoElement) videoElement.srcObject = remoteStream;
        }, 100);
      };
    }

    return (
      <Participant
        key={currentIndex}
        currentParticipant={currentParticipant}
        curentIndex={currentIndex}
        showAvatar={
          !currentParticipant.video &&
          !currentParticipant.screen &&
          currentParticipant.name
        }
      />
    );
  });

  const remoteName =
    hasRemote && props.participants[remoteKeys[0]]
      ? props.participants[remoteKeys[0]].name
      : null;

  return (
    <div className="stage">
      {/* Barra superior tipo WhatsApp con el nombre del contacto y estado. */}
      {hasRemote && (
        <div className="call-topbar">
          <div className="call-topbar-info">
            <span className="call-topbar-name">{remoteName || "Participante"}</span>
            <span className="call-topbar-status">
              <span className="call-status-dot" />
              En llamada
            </span>
          </div>
        </div>
      )}

      {/* Capa remota: contenedor fijo, alterna entre vista principal y PiP. */}
      <div
        className={`stage-slot remote-slot ${
          remoteIsMain ? "is-main" : "is-pip"
        } ${hasRemote ? "" : "hidden-slot"}`}
        onClick={!remoteIsMain && canSwap ? toggleSwap : undefined}
        title={!remoteIsMain && canSwap ? "Toca para intercambiar" : undefined}
      >
        {remoteParticipants}
      </div>

      {/* Capa del usuario actual: contenedor fijo, alterna principal/PiP. */}
      {currentUser && (
        <div
          className={`stage-slot self-slot ${
            remoteIsMain ? "is-pip" : "is-main"
          }`}
          onClick={remoteIsMain && canSwap ? toggleSwap : undefined}
          title={remoteIsMain && canSwap ? "Toca para intercambiar" : undefined}
        >
          <Participant
            currentParticipant={currentUser}
            curentIndex={currentUserKey}
            videoRef={videoRef}
            showAvatar={currentUser && !currentUser.video && !currentUser.screen}
            currentUser={true}
          />
        </div>
      )}

      {/* Estado de espera mientras el otro participante no se ha conectado. */}
      {!hasRemote && (
        <div className="waiting-overlay">
          <div className="waiting-card">
            <div className="waiting-pulse">
              <div className="waiting-avatar">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
            </div>
            <h2 className="waiting-title">Esperando al participante</h2>
            <p className="waiting-sub">
              La consulta comenzará cuando el otro participante se conecte.
            </p>
            <div className="waiting-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const mapStateToProps = (state) => {
  return {
    participants: state.participants,
    currentUser: state.currentUser,
    stream: state.mainStream,
  };
};

export default connect(mapStateToProps)(Participants);
