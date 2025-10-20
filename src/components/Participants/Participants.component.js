import React, { useEffect, useRef, useState, useCallback } from "react";
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
  const participantKey = Object.keys(props.participants);
  const [selfieSegmentation, setSelfieSegmentation] = useState(null);
  const [isSegmentationReady, setIsSegmentationReady] = useState(false);
  const segmentationInstancesRef = useRef(new Map());
  useEffect(() => {
    const initializeSelfieSegmentation = async () => {
      try {
        const segmentation = new selfie_segmentation.SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`,
        });
        
        segmentation.setOptions({
          modelSelection: 0
        });
        
        setSelfieSegmentation(segmentation);
        setIsSegmentationReady(true);
        console.log('Selfie segmentation initialized successfully');
      } catch (error) {
        console.error('Error initializing selfie segmentation:', error);
      }
    };

    initializeSelfieSegmentation();
  }, []);
  useEffect(() => {
    if (videoRef.current) {
      console.log('video current here')
      videoRef.current.srcObject = props.stream;
      videoRef.current.muted = true;
    }
  }, [props.currentUser, props.stream]);
  // Función para manejar background de participantes remotos
  const enableBackgroundForRemoteParticipants = useCallback(() => {
    if (!isSegmentationReady) {
      console.log('Segmentation not ready for remote participants');
      return;
    }

    const participantList = Object.keys(props.participants);
    
    participantList.forEach((element) => {
      const currentParticipant = props.participants[element];
      
      // Skip current user - se maneja por separado
      if (currentParticipant.currentUser) {
        console.log(`Skipping current user: ${element}`);
        return;
      }

      console.log(`Processing remote participant: ${element}`, {
        hasBackground: currentParticipant.background,
        className: currentParticipant.className
      });

      // Verificar que los elementos existen antes de manipularlos
      const videoElement = document.getElementById(`participantVideo${element}`);
      const canvasElement = document.getElementById(`participantCanvas${element}`);
      const imageElement = document.getElementById(`imageCanvas${element}`);
      
      // Solo proceder si todos los elementos existen
      if (!videoElement || !canvasElement || !imageElement) {
        console.warn(`Elements not found for remote participant ${element}`);
        return;
      }

      if (currentParticipant.background) {
        console.log(`Enabling background for remote participant: ${element}`);
        // Aplicar background virtual
        canvasElement.classList.remove("canvas-disabled");
        canvasElement.classList.add("canvas-enabled");
        
        const className = currentParticipant.className;
        imageElement.src = className || "";
        
        // Usar requestAnimationFrame en lugar de setTimeout para mejor rendimiento
        requestAnimationFrame(() => {
          if (videoElement.readyState >= 2) {
            mediapipeSegmentation(videoElement, canvasElement, imageElement, element);
          } else {
            // Esperar a que el video esté listo
            videoElement.addEventListener('loadeddata', () => {
              mediapipeSegmentation(videoElement, canvasElement, imageElement, element);
            }, { once: true });
          }
        });
      } else {
        console.log(`Disabling background for remote participant: ${element}`);
        // Deshabilitar background
        canvasElement.classList.remove("canvas-enabled");
        canvasElement.classList.add("canvas-disabled");
        imageElement.src = "";
        
        // Limpiar instancia de segmentación si existe
        const existingInstance = segmentationInstancesRef.current.get(element);
        if (existingInstance) {
          existingInstance.active = false;
          segmentationInstancesRef.current.delete(element);
        }
      }
    });
  }, [props.participants, isSegmentationReady]);

  // Función para manejar background del usuario actual
  const enableBackgroundForCurrentUser = useCallback(() => {
    if (!isSegmentationReady) {
      console.log('Segmentation not ready for current user');
      return;
    }

    const currentUser = props.currentUser ? Object.values(props.currentUser)[0] : null;
    
    if (!currentUser) {
      console.log('No current user found');
      return;
    }

    const videoElement = videoRef.current;
    
    // Encontrar el ID correcto del usuario actual
    // El currentUser se renderiza usando el primer key de participants, pero necesitamos encontrar 
    // cuál participante tiene currentUser: true
    let currentUserKey = null;
    
    // Buscar el participante que es currentUser
    Object.keys(props.participants).forEach(key => {
      if (props.participants[key].currentUser) {
        currentUserKey = key;
      }
    });
    
    // Si no encontramos el currentUser en participants, usar el primer key (fallback)
    if (!currentUserKey) {
      currentUserKey = Object.keys(props.participants)[0];
    }
    
    console.log('Current user background check:', {
      hasBackground: props.background,
      currentUserKey,
      allParticipantKeys: Object.keys(props.participants),
      participantsWithCurrentUser: Object.keys(props.participants).filter(key => props.participants[key].currentUser),
      videoElement: !!videoElement,
      className: props.className
    });
    
    // Buscar elementos específicamente para el usuario actual
    const canvasElement = document.getElementById(`participantCanvas${currentUserKey}`);
    const imageElement = document.getElementById(`imageCanvas${currentUserKey}`);
    
    console.log('DOM elements check:', {
      canvasElement: !!canvasElement,
      imageElement: !!imageElement,
      canvasId: `participantCanvas${currentUserKey}`,
      imageId: `imageCanvas${currentUserKey}`
    });

    if (!videoElement || !canvasElement || !imageElement) {
      console.warn(`Elements not found for current user with key: ${currentUserKey}`);
      return;
    }

    if (props.background) {
      console.log('Enabling background for current user with key:', currentUserKey);
      // Aplicar background virtual para usuario actual
      canvasElement.classList.remove("canvas-disabled");
      canvasElement.classList.add("canvas-enabled");
      
      imageElement.src = props.className || "";
      
      requestAnimationFrame(() => {
        if (videoElement.readyState >= 2) {
          console.log('Starting segmentation for current user');
          mediapipeSegmentation(videoElement, canvasElement, imageElement, 'currentUser');
        } else {
          videoElement.addEventListener('loadeddata', () => {
            console.log('Video loaded, starting segmentation for current user');
            mediapipeSegmentation(videoElement, canvasElement, imageElement, 'currentUser');
          }, { once: true });
        }
      });
    } else {
      console.log('Disabling background for current user');
      // Deshabilitar background para usuario actual
      canvasElement.classList.remove("canvas-enabled");
      canvasElement.classList.add("canvas-disabled");
      imageElement.src = "";
      
      const existingInstance = segmentationInstancesRef.current.get('currentUser');
      if (existingInstance) {
        existingInstance.active = false;
        segmentationInstancesRef.current.delete('currentUser');
      }
    }
  }, [props.background, props.className, isSegmentationReady, props.participants, props.currentUser]);
  // Effect para asignar canvasRef correctamente para el usuario actual
  useEffect(() => {
    // Encontrar el ID correcto del usuario actual
    let currentUserKey = Object.keys(props.participants).find(key => 
      props.participants[key].currentUser
    );
    
    if (!currentUserKey) {
      currentUserKey = Object.keys(props.participants)[0];
    }
    
    if (currentUserKey) {
      const canvasElement = document.getElementById(`participantCanvas${currentUserKey}`);
      if (canvasElement && canvasRef.current !== canvasElement) {
        canvasRef.current = canvasElement;
      }
    }
  }, [props.participants]);

  // Effect unificado para manejar backgrounds
  useEffect(() => {
    const timer = setTimeout(() => {
      // Manejar participantes remotos
      enableBackgroundForRemoteParticipants();
      // Manejar usuario actual
      enableBackgroundForCurrentUser();
    }, 150);

    return () => clearTimeout(timer);
  }, [props.participants, props.background, props.className, isSegmentationReady]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      // Desactivar todas las instancias de segmentación activas
      segmentationInstancesRef.current.forEach((instance) => {
        instance.active = false;
      });
      segmentationInstancesRef.current.clear();
    };
  }, []);


  const mediapipeSegmentation = useCallback(async (videoElement, canvasElement, imageElement, participantId) => {
    if (!selfieSegmentation || !videoElement || !canvasElement) {
      console.warn('Missing required elements for segmentation');
      return;
    }

    // Verificar si ya hay una instancia activa para este participante
    const existingInstance = segmentationInstancesRef.current.get(participantId);
    if (existingInstance) {
      existingInstance.active = false; // Desactivar la anterior
    }

    const canvasCtx = canvasElement.getContext("2d");
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    // Crear una nueva instancia de control
    const segmentationInstance = {
      active: true,
      participantId
    };
    
    segmentationInstancesRef.current.set(participantId, segmentationInstance);

    let frameCount = 0;
    const maxFPS = 15; // Limitar FPS para mejor rendimiento
    const frameInterval = 1000 / maxFPS;
    let lastFrameTime = 0;

    const drawCanvas = async (currentTime) => {
      // Verificar si esta instancia sigue activa
      if (!segmentationInstance.active) {
        return;
      }

      if (videoElement.readyState < 2) {
        requestAnimationFrame(drawCanvas);
        return;
      }

      // Controlar FPS
      if (currentTime - lastFrameTime < frameInterval) {
        requestAnimationFrame(drawCanvas);
        return;
      }
      
      lastFrameTime = currentTime;

      try {
        await selfieSegmentation.send({ image: videoElement });
        
        selfieSegmentation.onResults((results) => {
          if (!segmentationInstance.active) return;
          
          if (results.segmentationMask && canvasElement.width > 0 && canvasElement.height > 0) {
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            
            // Dibujar la máscara de segmentación
            canvasCtx.drawImage(
              results.segmentationMask,
              0,
              0,
              canvasElement.width,
              canvasElement.height
            );
            
            // Aplicar background si la imagen está cargada
            if (imageElement.complete && imageElement.src) {
              canvasCtx.globalCompositeOperation = "source-out";
              canvasCtx.drawImage(
                imageElement,
                0,
                0,
                canvasElement.width,
                canvasElement.height
              );
            }
            
            // Dibujar el video original sobre la máscara
            canvasCtx.globalCompositeOperation = "destination-atop";
            canvasCtx.drawImage(
              results.image,
              0,
              0,
              canvasElement.width,
              canvasElement.height
            );
            
            // Resetear composite operation
            canvasCtx.globalCompositeOperation = "source-over";
          }
        });
        
        frameCount++;
        if (segmentationInstance.active) {
          requestAnimationFrame(drawCanvas);
        }
      } catch (error) {
        console.error('Error in segmentation:', error);
        if (segmentationInstance.active) {
          setTimeout(() => requestAnimationFrame(drawCanvas), 1000); // Reintentar después de 1 segundo
        }
      }
    };

    drawCanvas();
  }, [selfieSegmentation]);
  const currentUser = props.currentUser
    ? Object.values(props.currentUser)[0]
    : null;
  
  console.log('=== PARTICIPANTS DEBUG ===');
  console.log('Current user:', currentUser);
  console.log('Background state:', props.background);
  console.log('Background class:', props.className);
  console.log('All participants:', props.participants);
  console.log('==========================')

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
    const currentIndex = element;
    
    if (pc) {
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
        
        // Usar setTimeout para asegurar que el DOM esté listo
        setTimeout(() => {
          const videoElement = document.getElementById(`participantVideo${currentIndex}`);
          const canvasElement = document.getElementById(`participantCanvas${currentIndex}`);
          
          if (videoElement) {
            videoElement.srcObject = remoteStream;
          }
          
          if (canvasElement) {
            canvasRef.current = canvasElement;
          }
        }, 100);
      };
    }

    return (
      <Participant
        key={currentIndex}
        currentParticipant={currentParticipant}
        curentIndex={currentIndex}
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
      {currentUser && (
        <Participant
          currentParticipant={currentUser}
          curentIndex={(() => {
            // Encontrar el ID correcto del usuario actual
            const currentUserKey = Object.keys(props.participants).find(key => 
              props.participants[key].currentUser
            );
            return currentUserKey || Object.keys(props.participants)[0];
          })()}
          hideVideo={screenPresenter && !currentUser.screen}
          videoRef={videoRef}
          background={props.background}
          showAvatar={currentUser && !currentUser.video && !currentUser.screen}
          currentUser={true}
          canvasRef={canvasRef}
        />
      )}
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