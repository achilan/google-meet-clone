import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faVideo,
  faDesktop,
  faVideoSlash,
  faMicrophoneSlash,
  faImage,
  faBan
} from "@fortawesome/free-solid-svg-icons";
import ReactTooltip from "react-tooltip";
import "./MeetingFooter.css";
import 'react-responsive-modal/styles.css';
import { Modal } from 'react-responsive-modal';
const MeetingFooter = (props) => {
  const [streamState, setStreamState] = useState({
    mic: true,
    video: false,
    screen: false,
    background: false,
    className: "",
  });
  const backgrounds = [
    {
      name: "background1",
      className: "https://ieced.com.ec/assets/bg1.jpg"
    },
    {
      name: "background2",
      className: "https://ieced.com.ec/assets/videollamada/1.jpg"
    },
    {
      name: "background3",
      className: "https://ieced.com.ec/assets/videollamada/2.jpg"
    },
    {
      name: "background4",
      className: "https://ieced.com.ec/assets/videollamada/3.jpg"
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
    setStreamState((currentState) => {
      return {
        ...currentState,
        video: !currentState.video,
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
  };
  const onChangeBackgroundPictureFooter = (a) => {
    setStreamState((currentState) => {
      return {
        ...currentState,
        className: a,
      };
    });
  };
  const openModalBackground = () => {
    setOpen(true);
  };
  const onCloseModal = () => {
    setOpen(false);
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
  return (
    <div className="meeting-footer">
      <div className={"meeting-icons " + (streamState.background ? "active" : "")} data-tip="Change Background" onClick={openModalBackground} >
        <FontAwesomeIcon icon={faImage} />
      </div>
      <Modal open={open} onClose={onCloseModal} center>
        <h2>Selecciona el fondo</h2>
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
      >
        <FontAwesomeIcon icon={!streamState.video ? faVideoSlash : faVideo} />
      </div>
      <div
        className="meeting-icons"
        data-tip="Share Screen"
        onClick={onScreenClick}
        disabled={streamState.screen}
      >
        <FontAwesomeIcon icon={faDesktop} />
      </div>
      <ReactTooltip />
    </div>
  );
};

export default MeetingFooter;
