import React, { useEffect, useRef, useState } from "react";
import "./Participants.css";
import { connect } from "react-redux";
import { Participant } from "./Participant/Participant.component";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as selfie_segmentation from "@mediapipe/selfie_segmentation";
import * as bodyPix from "@tensorflow-models/body-pix";
const Participants = (props) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  let participantKey = Object.keys(props.participants);
  const [SelfieSegmentation, setSelfieSegmentation] = useState(null);
  useEffect(() => {
    const segMentation = new selfie_segmentation.SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`,

    });
    segMentation.setOptions({
      modelSelection: 0
    });
    setSelfieSegmentation(segMentation);
    console.log('no error')
  }, []);
  useEffect(() => {
    if (videoRef.current && props.stream) {
      console.log('Setting video stream, currentUser:', props.currentUser);
      videoRef.current.srcObject = props.stream;
      videoRef.current.muted = true;
      
      // Force video to load and play
      videoRef.current.load();
      
      // Check if video track is enabled
      const videoTracks = props.stream.getVideoTracks();
      if (videoTracks.length > 0) {
        console.log('Video track enabled status:', videoTracks[0].enabled);
        console.log('Video track settings:', videoTracks[0].getSettings());
      }
      
      // Try to play the video
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Video play prevented:', error);
        });
      }
    }
  }, [props.currentUser, props.stream]);
  const enableBackground = () => {
    const participantList = Object.keys(props.participants);
    participantList.forEach((element) => {
      const participant = props.participants[element];
      
      // Don't enable background if video is disabled
      if (!participant.video && participant.currentUser) {
        const canvasRefx = document.getElementById(`participantCanvas${element}`);
        if (canvasRefx) {
          canvasRefx.classList.remove("background-enabled");
          canvasRefx.classList.add("background-disabled");
        }
        return;
      }
      
      if (participant.background) {
        const videoRefx = document.getElementById(`participantVideo${element}`);
        const canvasRefx = document.getElementById(`participantCanvas${element}`);
        const image = document.getElementById(`imageCanvas${element}`);
        
        if (canvasRefx) {
          canvasRefx.classList.remove("background-disabled");
          canvasRefx.classList.add("background-enabled");
        }
        
        const className = participant.className;
        if (image && className) {
          image.onload = () => {
            console.log('Image loaded successfully');
            if (videoRefx && canvasRefx && image) {
              setTimeout(() => {
                mediapipeSegmentation(videoRefx, canvasRefx, image);
              }, 1500);
            }
          };
          image.onerror = () => {
            console.error('Failed to load background image:', className);
          };
          image.src = className;
        } else if (videoRefx && canvasRefx) {
          // If no background image, still run segmentation without background
          setTimeout(() => {
            mediapipeSegmentation(videoRefx, canvasRefx, null);
          }, 1500);
        }
      } else {
        const canvasRefx = document.getElementById(`participantCanvas${element}`);
        const image = document.getElementById(`imageCanvas${element}`);
        
        if (canvasRefx) {
          canvasRefx.classList.remove("background-enabled");
          canvasRefx.classList.add("background-disabled");
        }
        
        if (image) {
          image.src = "";
        }
      }
    }
    );
  }
  useEffect(() => {
    enableBackground();
  }, [props.participants]);
  
  // Monitor video state changes for current user
  useEffect(() => {
    if (props.currentUser && videoRef.current && props.stream) {
      const videoTracks = props.stream.getVideoTracks();
      if (videoTracks.length > 0) {
        console.log('Current user video state changed:', props.currentUser.video);
        console.log('Video track enabled:', videoTracks[0].enabled);
        
        // If video is supposed to be on but track is disabled, or vice versa
        if (props.currentUser.video && !videoTracks[0].enabled) {
          console.log('Video should be on but track is disabled, enabling...');
          videoTracks[0].enabled = true;
        } else if (!props.currentUser.video && videoTracks[0].enabled) {
          console.log('Video should be off but track is enabled, disabling...');
          videoTracks[0].enabled = false;
        }
      }
    }
  }, [props.currentUser?.video, props.stream]);


  const mediapipeSegmentation = async (videoRef, canvasRef, image) => {
    // Check if video is enabled/available
    if (!videoRef || !canvasRef || videoRef.readyState < 2) {
      console.log('Video not ready for segmentation');
      return;
    }
    
    // Check if video track is enabled
    if (videoRef.srcObject) {
      const videoTracks = videoRef.srcObject.getVideoTracks();
      if (videoTracks.length > 0 && !videoTracks[0].enabled) {
        console.log('Video track is disabled, stopping segmentation');
        // Clear the canvas when video is disabled
        const canvasCtx = canvasRef.getContext("2d");
        canvasCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
        return;
      }
    }
    
    const canvasCtx = canvasRef.getContext("2d");
    canvasRef.width = videoRef.videoWidth;
    canvasRef.height = videoRef.videoHeight;
    
    let lastFrameTime = 0;
    const fps = 15; // Reduce FPS to improve performance
    const frameInterval = 1000 / fps;
    
    const drawCanvas = async (currentTime) => {
      if (currentTime - lastFrameTime < frameInterval) {
        requestAnimationFrame(drawCanvas);
        return;
      }
      lastFrameTime = currentTime;
      
      if (videoRef.readyState < 2) {
        requestAnimationFrame(drawCanvas);
        return;
      }
      
      // Check if video track is still enabled
      if (videoRef.srcObject) {
        const videoTracks = videoRef.srcObject.getVideoTracks();
        if (videoTracks.length > 0 && !videoTracks[0].enabled) {
          // Video disabled, clear canvas and stop
          canvasCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
          console.log('Video disabled during segmentation, stopping');
          return;
        }
      }
      
      try {
        if (!SelfieSegmentation) {
          requestAnimationFrame(drawCanvas);
          return;
        }
        await SelfieSegmentation.send({ image: videoRef });
        SelfieSegmentation.onResults(async (results) => {
          if (results.segmentationMask) {
            const segmentationMask = results.segmentationMask;
            canvasCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
            canvasCtx.drawImage(
              segmentationMask,
              0,
              0,
              canvasRef.width,
              canvasRef.height
            );
            
            // Check if image exists and is loaded properly
            if (image && image.complete && image.naturalHeight !== 0 && image.src && image.src !== "") {
              try {
                canvasCtx.globalCompositeOperation = "source-out";
                canvasCtx.drawImage(
                  image,
                  0,
                  0,
                  canvasRef.width,
                  canvasRef.height
                );
              } catch (drawError) {
                console.error("Error drawing background image:", drawError);
              }
            }
            
            canvasCtx.globalCompositeOperation = "destination-atop";
            canvasCtx.drawImage(
              results.image,
              0,
              0,
              canvasRef.width,
              canvasRef.height
            );
          }
        });
      } catch (error) {
        console.error("Segmentation error:", error);
      }
      requestAnimationFrame(drawCanvas);
    };
    requestAnimationFrame(drawCanvas);
  };
  const currentUser = props.currentUser
    ? Object.values(props.currentUser)[0]
    : null;
  console.log(currentUser,'current')

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
    console.log(currentParticipant,'currentParticipant')
    const isCurrentUser = currentParticipant.currentUser;
    if (isCurrentUser) {
      return null;
    }
    const pc = currentParticipant.peerConnection;
    const remoteStream = new MediaStream();
    let curentIndex = element;
    if (pc) {
      console.log(pc,'pc')
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
