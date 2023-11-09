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
        if (props.participants[element].className) {
          canvasRef.classList.remove("background1", "background2", "background3")
          canvasRef.classList.add(props.participants[element].className);
        }
        setTimeout(() => {
          bdPixelWithParameters(videoRef, canvasRef);
        }, 1500);
      } else {
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
    const tempCanvas = document.createElement("canvas");
    const blurRadius = 8;
    const context = canvasRef.getContext("2d");
    canvasRef.width = videoRef.videoWidth;
    canvasRef.height = videoRef.videoHeight;
    tempCanvas.width = videoRef.videoWidth;
    tempCanvas.height = videoRef.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    const targetFPS = 60; // Desired frame rate (in fps)
    const frameInterval = 1000 / targetFPS; // Time interval in milliseconds
    const runBodysegment = async () => {
      const net = await bodyPix.load({
        architecture: "MobileNetV1",
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
        segmentationThreshold: 0.7,
        internalResolution: "medium",
      });
    
      const drawMask = async () => {
        const startTime = performance.now(); // Record the start time
    
        const segmentation = await net.segmentPerson(videoRef, {
          flipHorizontal: false,
          internalResolution: "medium",
          segmentationThreshold: 0.7,
          maxDetections: 1,
        });
    
        const mask = bodyPix.toMask(segmentation);
        tempCtx.putImageData(mask, 0, 0);
    
        // Blur the mask to smooth the edges
        tempCtx.filter = `blur(${blurRadius}px)`;
        tempCtx.drawImage(tempCanvas, 0, 0);
    
        // Create a new canvas to store the blurred mask corners
        const cornerBlurCanvas = document.createElement('canvas');
        cornerBlurCanvas.width = canvasRef.width;
        cornerBlurCanvas.height = canvasRef.height;
        const cornerBlurCtx = cornerBlurCanvas.getContext('2d');
    
        // Copy the blurred mask to the corner blur canvas
        cornerBlurCtx.drawImage(tempCanvas, 0, 0);
    
        // Apply a stronger blur to the corners of the mask
        cornerBlurCtx.filter = `blur(${blurRadius * 2}px)`;
        cornerBlurCtx.drawImage(cornerBlurCanvas, 0, 0);
    
        // Composite the blurred mask corners onto the blurred mask
        tempCtx.save();
        tempCtx.globalCompositeOperation = "source-in";
        tempCtx.drawImage(cornerBlurCanvas, 0, 0, canvasRef.width, canvasRef.height);
        tempCtx.restore();
    
        // Composite the blurred mask onto the original video
        context.drawImage(videoRef, 0, 0, canvasRef.width, canvasRef.height);
        context.save();
        context.globalCompositeOperation = "destination-out";
        context.drawImage(tempCanvas, 0, 0, canvasRef.width, canvasRef.height);
        context.restore();
    
        const elapsedTime = performance.now() - startTime; // Calculate elapsed time
    
        // Calculate the delay needed to achieve the target frame rate
        const delay = Math.max(0, frameInterval - elapsedTime);
    
        // Clear the temporary canvas for the next iteration
        tempCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
        requestAnimationFrame(drawMask);
      };
    
      drawMask();
    };

    runBodysegment();
  }
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
