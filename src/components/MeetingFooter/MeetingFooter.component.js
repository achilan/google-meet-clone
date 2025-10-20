import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import background1 from "../../assets/1.jpg";
import background2 from "../../assets/2.jpg";
import background3 from "../../assets/3.jpg";
import {
  faMicrophone,
  faVideo,
  faDesktop,
  faVideoSlash,
  faMicrophoneSlash,
  faImage,
  faBan,
  faPhoneSlash
} from "@fortawesome/free-solid-svg-icons";
import ReactTooltip from "react-tooltip";
import "./MeetingFooter.css";
import 'react-responsive-modal/styles.css';
import { Modal } from 'react-responsive-modal';
const MeetingFooter = (props) => {
  // Get initial states from props or default values
  const initialVideoState = props.initialVideoState !== undefined ? props.initialVideoState : false;
  const initialMicState = props.initialMicState !== undefined ? props.initialMicState : true;
  
  console.log('MeetingFooter props:', { 
    initialVideoState: props.initialVideoState, 
    initialMicState: props.initialMicState 
  });
  
  const [streamState, setStreamState] = useState({
    mic: initialMicState,
    video: initialVideoState,
    screen: false,
    background: false,
    className: "",
  });
  const backgrounds = [
    {
      name: "background1",
      className: background1
    },
    {
      name: "background2",
      className: background2
    },
    {
      name: "background3",
      className: background3
    },
  ];
  const [open, setOpen] = useState(false);
  const micClick = () => {
    setStreamState((currentState) => {
      return {
        ...currentState,
        mic: !currentState.mic,
      };
    });
  };

  const onVideoClick = () => {
    console.log('Video button clicked, current state:', streamState.video);
    setStreamState((currentState) => {
      const newVideoState = !currentState.video;
      console.log('Setting video state to:', newVideoState);
      return {
        ...currentState,
        video: newVideoState,
      };
    });
  };
  const onChangeBackgroundFooter = (a) => {
    setStreamState((currentState) => {
      return {
        ...currentState,
        background: a,
      };
    });
    // Llamar también a la función de props para actualizar el Redux store
    if (props.onChangeBackground) {
      props.onChangeBackground(a);
    }
  };
  const onChangeBackgroundPictureFooter = (a) => {
    setStreamState((currentState) => {
      return {
        ...currentState,
        className: a,
      };
    });
    // Llamar también a la función de props para actualizar el Redux store
    if (props.onChangeBackgroundPicture) {
      props.onChangeBackgroundPicture(a);
    }
  };
  const openModalBackground = () => {
    setOpen(true);
  };
  const onCloseModal = () => {
    setOpen(false);
  };
  
  const onEndCall = () => {
    if (window.confirm("¿Estás seguro de que quieres finalizar la llamada?")) {
      // Close the current window/tab
      window.close();
      // If window.close() doesn't work (some browsers prevent it), try redirecting
      setTimeout(() => {
        window.location.href = "about:blank";
      }, 100);
    }
  };
  const onScreenClick = () => {
    props.onScreenClick(setScreenState);
  };
  const setScreenState = (isEnabled) => {
    setStreamState((currentState) => {
      return {
        ...currentState,
        screen: isEnabled,
      };
    });
  };
  useEffect(() => {
    props.onMicClick(streamState.mic);
  }, [streamState.mic]);
  useEffect(() => {
    props.onVideoClick(streamState.video);
  }, [streamState.video]);
  useEffect(() => {
    props.onChangeBackground(streamState.background);
  }, [streamState.background]);
  useEffect(() => {
    props.onChangeBackgroundPicture(streamState.className);
  }, [streamState.className]);
  
  // Sync with external state changes (only when props actually change)
  useEffect(() => {
    if (props.initialVideoState !== undefined) {
      setStreamState(currentState => {
        if (currentState.video !== props.initialVideoState) {
          return {
            ...currentState,
            video: props.initialVideoState
          };
        }
        return currentState;
      });
    }
  }, [props.initialVideoState]);
  
  useEffect(() => {
    if (props.initialMicState !== undefined) {
      setStreamState(currentState => {
        if (currentState.mic !== props.initialMicState) {
          return {
            ...currentState,
            mic: props.initialMicState
          };
        }
        return currentState;
      });
    }
  }, [props.initialMicState]);
  return (
    <div className="meeting-footer">
      <div className={"meeting-icons " + (streamState.background ? "active" : "")} data-tip="Change Background" onClick={openModalBackground} >
        <FontAwesomeIcon icon={faImage} />
      </div>
      <Modal 
        open={open} 
        onClose={onCloseModal} 
        center
        showCloseIcon={false}
        classNames={{
          modal: 'custom-modal-backgrounds',
          overlay: 'custom-modal-overlay'
        }}
      >
        <div className="modal-header">
          <h2>Selecciona el fondo</h2>
          <button className="close-button" onClick={onCloseModal}>×</button>
        </div>
        <div className="backgrounds">
          <div
            key="none"
            className={`background-selection center gray none ${streamState.className === "" ? "active-background" : ""}`}
            onClick={() => {
              onChangeBackgroundFooter(false);
              onChangeBackgroundPictureFooter("");
              //onCloseModal();
            }}
          >
            <FontAwesomeIcon fontSize={30} color="#fff" icon={faBan} />
          </div>
          {backgrounds.map((background) => (
            <div
              key={background.name}
              className={`background-selection ${background.name} ${streamState.className === background.className ? "active-background" : ""}`}
              onClick={() => {
                if(!streamState.video){
                  alert("Activa tu video para poder cambiar el fondo");
                  return;
                }
                onChangeBackgroundPictureFooter(background.className);
                onChangeBackgroundFooter(true);
                //onCloseModal();
              }}
            ></div>
          ))}
        </div>
      </Modal>
      <div
        className={"meeting-icons " + (!streamState.mic ? "active" : "")}
        data-tip={streamState.mic ? "Mute Audio" : "Unmute Audio"}
        onClick={micClick}
        onTouchEnd={(e) => {
          e.preventDefault();
          micClick();
        }}
        style={{ 
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <FontAwesomeIcon
          icon={!streamState.mic ? faMicrophoneSlash : faMicrophone}
          title="Mute"
        />
      </div>
      <div
        className={"meeting-icons " + (!streamState.video ? "active" : "")}
        data-tip={streamState.video ? "Hide Video" : "Show Video"}
        onClick={onVideoClick}
        onTouchEnd={(e) => {
          e.preventDefault();
          onVideoClick();
        }}
        style={{ 
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <FontAwesomeIcon icon={!streamState.video ? faVideoSlash : faVideo} />
      </div>
     {/*  <div
        className="meeting-icons"
        data-tip="Share Screen"
        onClick={onScreenClick}
        disabled={streamState.screen}
      >
        <FontAwesomeIcon icon={faDesktop} />
      </div> */}
      <div
        className="meeting-icons end-call-button"
        data-tip="Finalizar llamada"
        onClick={onEndCall}
      >
        <FontAwesomeIcon icon={faPhoneSlash} />
      </div>
      <ReactTooltip />
    </div>
  );
};

export default MeetingFooter;
