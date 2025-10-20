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
  const drawingFrames = useRef({}); // Track drawing loops for each participant
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
      
      // For current user with video disabled, still set up canvas for direct drawing
      if (!participant.video && participant.currentUser) {
        const videoRefx = document.getElementById(`participantVideo${element}`);
        const canvasRefx = document.getElementById(`participantCanvas${element}`);
        if (canvasRefx) {
          canvasRefx.classList.remove("background-enabled");
          canvasRefx.classList.add("background-disabled");
          console.log('Mobile: Video disabled but setting up canvas for direct drawing');
          // Still draw video directly to canvas even when video state is "disabled"
          if (videoRefx) {
            setTimeout(() => {
              drawVideoToCanvas(videoRefx, canvasRefx, element);
            }, 500);
          }
        }
        return;
      }
      
      if (participant.background) {
        const videoRefx = document.getElementById(`participantVideo${element}`);
        const canvasRefx = document.getElementById(`participantCanvas${element}`);
        const image = document.getElementById(`imageCanvas${element}`);
        
        // Cancel any direct video drawing
        if (drawingFrames.current[element]) {
          cancelAnimationFrame(drawingFrames.current[element]);
          delete drawingFrames.current[element];
        }
        
        if (canvasRefx) {
          canvasRefx.classList.remove("background-disabled");
          canvasRefx.classList.add("background-enabled");
        }
        
        const className = participant.className;
        if (image && className) {
          image.onload = () => {
            console.log('Image loaded successfully for background:', className);
            if (videoRefx && canvasRefx && image) {
              // Start immediately when image loads
              mediapipeSegmentation(videoRefx, canvasRefx, image);
            }
          };
          image.onerror = () => {
            console.error('Failed to load background image:', className);
          };
          image.src = className;
        } else if (videoRefx && canvasRefx) {
          // If no background image, still run segmentation without background
          console.log('Starting segmentation without background image');
          mediapipeSegmentation(videoRefx, canvasRefx, null);
        }
      } else {
        // No background - draw video directly to canvas
        const videoRefx = document.getElementById(`participantVideo${element}`);
        const canvasRefx = document.getElementById(`participantCanvas${element}`);
        const image = document.getElementById(`imageCanvas${element}`);
        
        if (canvasRefx) {
          canvasRefx.classList.remove("background-enabled");
          canvasRefx.classList.add("background-disabled");
        }
        
        if (image) {
          image.src = "";
        }
        
        // Draw video directly to canvas when no background is applied
        if (videoRefx && canvasRefx && participant.currentUser) {
          console.log('Mobile: Starting direct video draw for participant:', element);
          console.log('Mobile: Canvas classes before:', canvasRefx.className);
          setTimeout(() => {
            drawVideoToCanvas(videoRefx, canvasRefx, element);
          }, 500);
        }
      }
    }
    );
  }
  useEffect(() => {
    // Only update background for participants when participants list changes, not on every background change
    if (Object.keys(props.participants).length > 0) {
      setTimeout(() => {
        enableBackground();
      }, 50);
    }
  }, [props.participants]); // Removed props.background to prevent updates for remote users
  
  // Monitor video state changes for current user
  useEffect(() => {
    console.log('Video state changed for current user:', props.currentUser?.video);
    
    // Handle canvas changes with a small delay to prevent rapid updates
    const timeoutId = setTimeout(() => {
      handleCurrentUserCanvas();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [props.currentUser?.video]);

  // Monitor background changes separately for current user only
  useEffect(() => {
    console.log('Background state changed for current user:', props.background);
    
    // Handle background changes only for current user
    const timeoutId = setTimeout(() => {
      handleCurrentUserCanvas();
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [props.background]);

  // Monitor background image changes for current user only
  useEffect(() => {
    if (props.className && props.background && props.currentUser) {
      console.log('Background image changed to:', props.className);
      // Force background update only for current user, not all participants
      setTimeout(() => {
        handleCurrentUserCanvas();
      }, 100);
    }
  }, [props.className]);

  const handleCurrentUserCanvas = () => {
    if (!props.currentUser) return;
    
    const currentUserIndex = Object.keys(props.participants)[0];
    const videoRefx = document.getElementById(`participantVideo${currentUserIndex}`);
    const canvasRefx = document.getElementById(`participantCanvas${currentUserIndex}`);
    
    console.log('Mobile: Handling ONLY current user canvas - not affecting remote participants');
    console.log('Mobile: Current user has background:', props.background);
    console.log('Mobile: Current user video enabled:', props.currentUser.video);
    
    // Always cancel existing drawing to prevent conflicts
    if (drawingFrames.current[currentUserIndex]) {
      console.log('Mobile: Canceling existing drawing');
      cancelAnimationFrame(drawingFrames.current[currentUserIndex]);
      delete drawingFrames.current[currentUserIndex];
    }
    
    if (!videoRefx || !canvasRefx) {
      console.log('Mobile: Missing video or canvas element');
      return;
    }
    
    if (!props.currentUser.video) {
      // Video is disabled, clear canvas and stop
      const canvasCtx = canvasRefx.getContext("2d");
      canvasCtx.clearRect(0, 0, canvasRefx.width, canvasRefx.height);
      canvasRefx.style.display = 'none';
      console.log('Mobile: Video disabled by user, canvas cleared and hidden');
      return;
    }
    
    // Video is enabled - set up canvas based on background setting
    canvasRefx.style.display = 'block';
    canvasRefx.style.opacity = '1';
    
    if (props.background) {
      // Background enabled - use MediaPipe
      canvasRefx.classList.remove("background-disabled");
      canvasRefx.classList.add("background-enabled");
      console.log('Mobile: Setting up MediaPipe segmentation');
    } else {
      // No background - direct drawing with delay to avoid conflicts
      canvasRefx.classList.remove("background-enabled");
      canvasRefx.classList.add("background-disabled");
      console.log('Mobile: Setting up direct video drawing');
      setTimeout(() => {
        drawVideoToCanvas(videoRefx, canvasRefx, currentUserIndex);
      }, 100); // Reduced delay
    }
  };

  const drawVideoToCanvas = (videoRef, canvasRef, participantId) => {
    console.log('Mobile: drawVideoToCanvas called for participant:', participantId);
    console.log('Mobile: Video element:', videoRef);
    console.log('Mobile: Canvas element:', canvasRef);
    console.log('Mobile: Video readyState:', videoRef?.readyState);
    console.log('Mobile: Video dimensions:', videoRef?.videoWidth, 'x', videoRef?.videoHeight);
    
    if (!videoRef || !canvasRef) {
      console.error('Mobile: Missing video or canvas element');
      return;
    }
    
    const canvasCtx = canvasRef.getContext("2d");
    
    // Cancel any existing drawing loop for this participant
    if (drawingFrames.current[participantId]) {
      cancelAnimationFrame(drawingFrames.current[participantId]);
    }
    
    // Make sure canvas is visible and has correct classes for direct drawing
    canvasRef.style.display = 'block';
    canvasRef.style.opacity = '1';
    canvasRef.classList.remove("background-enabled");
    canvasRef.classList.add("background-disabled");
    console.log('Mobile: Canvas classes set to:', canvasRef.className);
    console.log('Mobile: Switching to direct drawing mode - MediaPipe will be blocked');
    
    let frameCount = 0;
    const drawFrame = () => {
      frameCount++;
      
      if (!videoRef || !canvasRef) {
        console.log('Mobile: Video or canvas disappeared, stopping draw');
        return;
      }
      
      if (videoRef.readyState < 2) {
        if (frameCount % 60 === 0) { // Log every 60 frames
          console.log('Mobile: Video not ready, readyState:', videoRef.readyState);
        }
        drawingFrames.current[participantId] = requestAnimationFrame(drawFrame);
        return;
      }
      
      // For direct video drawing, we still draw even if track is "disabled"
      // because we want to show the video stream directly
      if (videoRef.srcObject) {
        const videoTracks = videoRef.srcObject.getVideoTracks();
        if (videoTracks.length > 0) {
          console.log('Mobile: Video track enabled status:', videoTracks[0].enabled);
          // Don't return here for direct drawing - we want to show the video regardless
        }
      }
      
      if (videoRef.videoWidth > 0 && videoRef.videoHeight > 0) {
        canvasRef.width = videoRef.videoWidth;
        canvasRef.height = videoRef.videoHeight;
        
        // Draw video directly to canvas
        canvasCtx.drawImage(videoRef, 0, 0, canvasRef.width, canvasRef.height);
        
        if (frameCount === 1) {
          console.log('Mobile: First frame drawn successfully!');
        }
      }
      
      drawingFrames.current[participantId] = requestAnimationFrame(drawFrame);
    };
    
    console.log('Mobile: Starting draw loop');
    drawFrame();
  };

  const mediapipeSegmentation = async (videoRef, canvasRef, image) => {
    // Check if canvas is in direct drawing mode (background-disabled)
    if (canvasRef && canvasRef.classList.contains('background-disabled')) {
      console.log('Canvas is in direct drawing mode, skipping MediaPipe segmentation');
      return;
    }
    
    // Check if video is enabled/available
    if (!videoRef || !canvasRef || videoRef.readyState < 2) {
      console.log('Video not ready for segmentation');
      return;
    }
    
    const canvasCtx = canvasRef.getContext("2d");
    canvasRef.width = videoRef.videoWidth;
    canvasRef.height = videoRef.videoHeight;
    
    // Check if video track is enabled
    if (videoRef.srcObject) {
      const videoTracks = videoRef.srcObject.getVideoTracks();
      if (videoTracks.length > 0 && !videoTracks[0].enabled) {
        console.log('Video track is disabled, clearing canvas');
        canvasCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
        return;
      }
    }
    
    let lastFrameTime = 0;
    const fps = 15; // Reduce FPS to improve performance
    const frameInterval = 1000 / fps;
    
    const drawCanvas = async (currentTime) => {
      // Check if canvas switched to direct drawing mode
      if (canvasRef.classList.contains('background-disabled')) {
        console.log('Canvas switched to direct drawing mode, stopping MediaPipe');
        return;
      }
      
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
