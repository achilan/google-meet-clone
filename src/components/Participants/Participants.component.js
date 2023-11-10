import React, { useEffect, useRef, useState } from "react";
import "./Participants.css";
import { connect } from "react-redux";
import { Participant } from "./Participant/Participant.component";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as bodyPix from "@tensorflow-models/body-pix";
const Participants = (props) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  let participantKey = Object.keys(props.participants);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = props.stream;
      videoRef.current.muted = true;
    }
  }, [props.currentUser, props.stream]);
  const enableBackground = () => {
    const participantList = Object.keys(props.participants);
    participantList.forEach((element) => {
      if (props.participants[element].background) {
        const videoRef = document.getElementById(`participantVideo${element}`);
        const canvasRef = document.getElementById(`participantCanvas${element}`);
        canvasRef.classList.remove("background-disabled");
        canvasRef.classList.add("background-enabled");
        if(props.participants[element].className){
          canvasRef.classList.remove("background1", "background2", "background3")
          canvasRef.classList.add(props.participants[element].className);
        }
        setTimeout(() => {
          bdPixelWithParameters(videoRef, canvasRef);
        }, 1500);
      }else{
        const canvasRef = document.getElementById(`participantCanvas${element}`);
        canvasRef.classList.remove("background-enabled");
        canvasRef.classList.add("background-disabled");
      }
    }
    );
  }
  useEffect(() => {
    enableBackground();
  }, [props.participants]);
  const bdPixelWithParameters = async (videoRef, canvasRef) => {
    // Use MediaPipe to get segmentation mask
    canvasRef.width = videoRef.videoWidth;
    canvasRef.height = videoRef.videoHeight;
    const selfieSegmentation = new mpSelfieSegmentation.SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      
    });
  
    selfieSegmentation.setOptions({
      modelSelection: 1,
    });
  
    const drawCanvas = async () => {
      const canvasCtx = canvasRef.getContext("2d");
  
      // Start processing frames
      await selfieSegmentation.send({ image: videoRef });
  
      // Set up the onResults callback
      selfieSegmentation.onResults(async (results) => {
        if (results.segmentationMask) {
          const smoothedMask = applySmoothing(results.segmentationMask)
          canvasCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
          canvasCtx.drawImage(
            smoothedMask,
            0,
            0,
            canvasRef.width,
            canvasRef.height
          );
          canvasCtx.globalCompositeOperation = "source-in";
          canvasCtx.drawImage(
            videoRef,
            0,
            0,
            canvasRef.width,
            canvasRef.height
          );
          canvasCtx.globalCompositeOperation = "source-over";
        }
      });
  
      // Request the next animation frame
      requestAnimationFrame(drawCanvas);
    };
  
    // Start the initial frame processing
    drawCanvas();
    const applySmoothing = (mask) => {
      const smoothedMaskCanvas = document.createElement("canvas");
      const smoothedMaskCtx = smoothedMaskCanvas.getContext("2d");
    
      // Set the size of the temporary canvas
      smoothedMaskCanvas.width = mask.width;
      smoothedMaskCanvas.height = mask.height;
    
      // Apply smoothing filter
      smoothedMaskCtx.filter = "blur(5px)";
      smoothedMaskCtx.drawImage(mask, 0, 0);
    
      return smoothedMaskCanvas;
    };
  };
  const currentUser = props.currentUser
    ? Object.values(props.currentUser)[0]
    : null;

  let gridCol =
    participantKey.length === 1 ? 1 : participantKey.length <= 4 ? 2 : 4;
  const gridColSize = participantKey.length <= 4 ? 1 : 2;
  let gridRowSize =
    participantKey.length <= 4
      ? participantKey.length
      : Math.ceil(participantKey.length / 2);

  const screenPresenter = participantKey.find((element) => {
    const currentParticipant = props.participants[element];
    return currentParticipant.screen;
  });

  if (screenPresenter) {
    gridCol = 1;
    gridRowSize = 2;
  }
  var backgroundperuser = false;
  const participants = participantKey.map((element, index) => {
    const currentParticipant = props.participants[element];
    const isCurrentUser = currentParticipant.currentUser;
    if (isCurrentUser) {
      return null;
    }
    const pc = currentParticipant.peerConnection;
    const remoteStream = new MediaStream();
    let curentIndex = element;
    if (pc) {
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
        const videElement = document.getElementById(
          `participantVideo${curentIndex}`
        );
        const canvasElement = document.getElementById(
          `participantCanvas${curentIndex}`
        );
        canvasRef.current = canvasElement;
        if (videElement) {
          videElement.srcObject = remoteStream
        }
      };
    }

    return (
      <Participant
        key={curentIndex}
        currentParticipant={currentParticipant}
        curentIndex={curentIndex}
        hideVideo={screenPresenter && screenPresenter !== element}
        showAvatar={
          !currentParticipant.video &&
          !currentParticipant.screen &&
          currentParticipant.name
        }
        background={backgroundperuser}
        canvasRef={canvasRef}
      />
    );
  });
  return (
    <div
      style={{
        "--grid-size": gridCol,
        "--grid-col-size": gridColSize,
        "--grid-row-size": gridRowSize,
      }}
      className={`participants`}
    >
      {participants}
      <Participant
        currentParticipant={currentUser}
        curentIndex={Object.keys(props.participants)[0]}
        hideVideo={screenPresenter && !currentUser.screen}
        videoRef={videoRef}
        background={props.background}
        showAvatar={currentUser && !currentUser.video && !currentUser.screen}
        currentUser={true}
        canvasRef={canvasRef}
      />
    </div>
  );
};

const mapStateToProps = (state) => {
  return {
    participants: state.participants,
    currentUser: state.currentUser,
    stream: state.mainStream,
    background: state.background,
    className: state.className
  };
};

export default connect(mapStateToProps)(Participants);
