import React, { useRef, useEffect, useState } from "react";
import MeetingFooter from "../MeetingFooter/MeetingFooter.component";
import Participants from "../Participants/Participants.component";
import "./MainScreen.css";
import { connect } from "react-redux";
import {
  setMainStream,
  updateUser,
  setBackgroundStream,
  setBackgroundPicture,
} from "../../store/actioncreator";
import { BackgroundProcessor, BLUR_BACKGROUND } from "../../server/backgroundProcessor";

// Resuelve el valor de `className` a la imagen que usa el procesador:
// el centinela de desenfoque (o vacío) => null (usa el propio video desenfocado).
const resolveBackgroundImage = (className) =>
  !className || className === BLUR_BACKGROUND ? null : className;

const MainScreen = (props) => {
  const participantRef = useRef(props.participants);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  // Cámara cruda (fuente de verdad para mic/cámara). El track saliente puede ser
  // este mismo o el procesado por el BackgroundProcessor cuando hay fondo virtual.
  const rawStreamRef = useRef(null);
  const displayStreamRef = useRef(null);
  const processorRef = useRef(null);
  const processedTrackRef = useRef(null);
  const classNameRef = useRef(props.className);

  // Mantener rawStreamRef con la cámara cruda; ignorar el stream de display propio.
  useEffect(() => {
    if (props.stream && props.stream !== displayStreamRef.current) {
      rawStreamRef.current = props.stream;
    }
  }, [props.stream]);

  useEffect(() => {
    classNameRef.current = props.className;
  }, [props.className]);

  // Estado inicial de la cámara/mic al montar.
  useEffect(() => {
    const raw = rawStreamRef.current || props.stream;
    if (raw) {
      const videoTrack = raw.getVideoTracks()[0];
      const audioTrack = raw.getAudioTracks()[0];
      if (videoTrack) setIsVideoEnabled(videoTrack.enabled);
      if (audioTrack) setIsMicEnabled(audioTrack.enabled);
    }
  }, [props.stream]);

  // Liberar el procesador al desmontar.
  useEffect(() => {
    return () => {
      if (processorRef.current) {
        processorRef.current.destroy();
        processorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    participantRef.current = props.participants;
  }, [props.participants]);

  // Reemplaza el track de video saliente en todas las peer connections.
  const replaceOutgoingVideo = (track) => {
    const participants = participantRef.current || {};
    for (let key in participants) {
      const sender = participants[key];
      if (sender.currentUser || !sender.peerConnection) continue;
      const videoSender = sender.peerConnection
        .getSenders()
        .find((s) => (s.track ? s.track.kind === "video" : false));
      if (videoSender) {
        videoSender.replaceTrack(track).catch(() => {});
      }
    }
  };

  const onMicClick = (micEnabled) => {
    const raw = rawStreamRef.current;
    const audioTrack = raw && raw.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = micEnabled;
      props.updateUser({ audio: micEnabled });
      setIsMicEnabled(micEnabled);
    }
  };

  const onVideoClick = (videoEnabled) => {
    const raw = rawStreamRef.current;
    const rawVideo = raw && raw.getVideoTracks()[0];
    if (rawVideo) rawVideo.enabled = videoEnabled;

    // Reflejar el estado en el track procesado y pausar/reanudar el procesador.
    if (processedTrackRef.current) processedTrackRef.current.enabled = videoEnabled;
    if (processorRef.current) {
      if (videoEnabled) processorRef.current.start();
      else processorRef.current.stop();
    }

    props.updateUser({ video: videoEnabled });
    setIsVideoEnabled(videoEnabled);
  };

  // --- Compartir pantalla (deshabilitado en la UI, se conserva la lógica) ---
  const updateStream = (stream) => {
    replaceOutgoingVideo(stream.getVideoTracks()[0]);
    displayStreamRef.current = null;
    props.setMainStream(stream);
  };

  const onScreenShareEnd = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    localStream.getVideoTracks()[0].enabled = Object.values(props.currentUser)[0].video;
    updateStream(localStream);
    props.updateUser({ screen: false });
  };

  const onScreenClick = async () => {
    let mediaStream;
    if (navigator.getDisplayMedia) {
      mediaStream = await navigator.getDisplayMedia({ video: true });
    } else if (navigator.mediaDevices.getDisplayMedia) {
      mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } else {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { mediaSource: "screen" },
      });
    }
    mediaStream.getVideoTracks()[0].onended = onScreenShareEnd;
    updateStream(mediaStream);
    props.updateUser({ screen: true });
  };

  // --- Fondo virtual: segmentación en el EMISOR ---
  const onChangeBackground = async (backgroundEnabled) => {
    const raw = rawStreamRef.current;
    if (!raw || raw.getVideoTracks().length === 0) return;

    if (backgroundEnabled) {
      if (!processorRef.current) {
        processorRef.current = new BackgroundProcessor();
      }
      const proc = processorRef.current;
      await proc.setInputStream(raw);
      await proc.setBackgroundImage(resolveBackgroundImage(classNameRef.current));
      proc.start();

      const processedTrack = proc.getOutputStream().getVideoTracks()[0];
      processedTrackRef.current = processedTrack;
      processedTrack.enabled = raw.getVideoTracks()[0].enabled;

      // Enviar el track procesado a los peers y mostrarlo localmente.
      replaceOutgoingVideo(processedTrack);
      const display = new MediaStream();
      display.addTrack(processedTrack);
      raw.getAudioTracks().forEach((t) => display.addTrack(t));
      displayStreamRef.current = display;
      props.setMainStream(display);

      props.setBackgroundStream(true);
      props.updateUser({ background: true });
    } else {
      const rawVideo = raw.getVideoTracks()[0];
      replaceOutgoingVideo(rawVideo);
      if (processorRef.current) processorRef.current.stop();
      processedTrackRef.current = null;
      displayStreamRef.current = null;
      props.setMainStream(raw);

      props.setBackgroundStream(false);
      props.updateUser({ background: false });
    }
  };

  const onChangeBackgroundPicture = async (className) => {
    props.setBackgroundPicture(className);
    props.updateUser({ className: className });
    // Actualiza la imagen en vivo si el procesador ya está activo (incluye el
    // caso "desenfocar", que resuelve a null y usa el propio video borroso).
    if (processorRef.current && className) {
      await processorRef.current.setBackgroundImage(resolveBackgroundImage(className));
    }
  };

  return (
    <div className="wrapper">
      <div className="main-screen">
        <Participants />
      </div>

      <div className="footer">
        <MeetingFooter
          onScreenClick={onScreenClick}
          onMicClick={onMicClick}
          onVideoClick={onVideoClick}
          onChangeBackground={onChangeBackground}
          onChangeBackgroundPicture={onChangeBackgroundPicture}
          initialVideoState={isVideoEnabled}
          initialMicState={isMicEnabled}
        />
      </div>
    </div>
  );
};

const mapStateToProps = (state) => {
  return {
    stream: state.mainStream,
    participants: state.participants,
    currentUser: state.currentUser,
    background: state.background,
    className: state.className,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setMainStream: (stream) => dispatch(setMainStream(stream)),
    updateUser: (user) => dispatch(updateUser(user)),
    setBackgroundStream: (background) => dispatch(setBackgroundStream(background)),
    setBackgroundPicture: (className) => dispatch(setBackgroundPicture(className)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(MainScreen);
