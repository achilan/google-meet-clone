import React, { useState, useEffect, useRef } from "react";
import "./WaitingRoom.css";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Lock,
  Info,
  Wifi,
  Volume,
  User,
  Stethoscope,
  Clock,
  ShieldCheck,
} from "../Shared/icons";

const WaitingRoom = ({ onJoinAsDoctor, onJoinAsPatient, isDoctorPresent }) => {
  const [userType, setUserType] = useState("");
  const [patientName, setPatientName] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  
  // Media devices state
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMicrophone, setSelectedMicrophone] = useState("");
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [hasMediaPermission, setHasMediaPermission] = useState(false);
  
  // Detectar si estamos en modo modal (navegador del doctor)
  const [isModalMode, setIsModalMode] = useState(false);
  
  const videoRef = useRef(null);
  
  // Get available media devices
  const getMediaDevices = async () => {
    try {
      // Request permission first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      // Now get the device list
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      setCameras(videoDevices);
      setMicrophones(audioDevices);
      
      // Set default devices
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      if (audioDevices.length > 0) {
        setSelectedMicrophone(audioDevices[0].deviceId);
      }
      
      setHasMediaPermission(true);
      
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setHasMediaPermission(false);
    }
  };
  const verifyRoleToken = async (token) => {
    try {
      if (!token) return null;
      if (token === 'd') return 'doctor';
      if (token === 'p') return 'patient';
      try {
        const role = atob(token);
        if (role === 'doctor' || role === 'patient') return role;
      } catch (e) {
        return null;
      }
      return null;
    } catch (e) {
      return null;
    }
  };
  const startVideoStream = async () => {
    try {
      //console.log('Starting video stream with camera:', selectedCamera, 'microphone:', selectedMicrophone);
      
      if (stream) {
        //console.log('Stopping existing stream');
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMicrophone ? { deviceId: { exact: selectedMicrophone } } : true
      };
      
      //console.log('getUserMedia constraints:', constraints);

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        //console.log('Video stream set to video element');
      }

      // Apply current audio/video states
      const audioTrack = newStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMicrophoneOn;
        //console.log('Audio track enabled:', isMicrophoneOn);
      }

      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isCameraOn;
        //console.log('Video track enabled:', isCameraOn);
      }
      
      //console.log('Video stream started successfully');

    } catch (error) {
      console.error('Error starting video stream:', error);
      // Fallback to default devices if exact device fails
      if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
        try {
          //console.log('Trying fallback with default devices');
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          
          setStream(fallbackStream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          
          const audioTrack = fallbackStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = isMicrophoneOn;
          }

          const videoTrack = fallbackStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.enabled = isCameraOn;
          }
          
          //console.log('Fallback stream started successfully');
        } catch (fallbackError) {
          //console.error('Fallback stream also failed:', fallbackError);
        }
      }
    }
  };

  useEffect(() => {
    // Detectar dispositivo y contexto
    const checkEnvironment = () => {
      const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTablet = window.innerWidth > 480 && window.innerWidth <= 1024 && /iPad/i.test(navigator.userAgent);
      const isInModal = window.parent !== window; // Detecta si está en iframe/modal
      const isDesktop = window.innerWidth > 768 && !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Modal mode para doctor en navegador, tablets o cuando está en un iframe
      setIsModalMode(isTablet || isInModal);
      //console.log(`Environment - Mobile: ${isMobile}, Tablet: ${isTablet}, Desktop: ${isDesktop}, InModal: ${isInModal}`);
    };
    
    checkEnvironment();

    // If a role token is present in the URL, verify it and set userType automatically.
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const roleToken = params.get('rt');
      if (roleToken) {
        const role = await verifyRoleToken(roleToken);
        if (role) {
          setUserType(role);
          // trigger media enumeration after role is established
          await getMediaDevices();
        } else {
          alert('Token de rol inválido o expirado. Por favor use el enlace correcto.');
        }
      } else {
        // No token provided: inform the user to use the proper link
        //alert('No se encontró token de rol (rt) en la URL. Por favor use el enlace proporcionado por el sistema.');
      }
    })();
    
    // Recheck on resize and orientation change
    window.addEventListener('resize', checkEnvironment);
    window.addEventListener('orientationchange', () => {
      setTimeout(checkEnvironment, 100); // Delay to get accurate dimensions after orientation change
    });
    
    return () => {
      window.removeEventListener('resize', checkEnvironment);
      window.removeEventListener('orientationchange', checkEnvironment);
      // Clean up stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start video when user type is selected and devices are ready
  useEffect(() => {
    if (userType && hasMediaPermission && selectedCamera) {
      //console.log('useEffect triggered - starting video stream');
      startVideoStream();
    }
  }, [userType, hasMediaPermission, selectedCamera, selectedMicrophone]);

  // Toggle camera
  const toggleCamera = () => {
    setIsCameraOn(!isCameraOn);
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCameraOn;
      }
    }
  };

  // Toggle microphone
  const toggleMicrophone = () => {
    setIsMicrophoneOn(!isMicrophoneOn);
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicrophoneOn;
      }
    }
  };

  // Handle camera change
  const handleCameraChange = async (deviceId) => {
    //console.log('Changing camera to:', deviceId);
    setSelectedCamera(deviceId);
    
    // If we already have a stream and permission, restart it immediately
    if (stream && hasMediaPermission && userType) {
      try {
        // Stop current stream
        stream.getTracks().forEach(track => track.stop());
        
        // Start new stream with new camera
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: deviceId } : true,
          audio: selectedMicrophone ? { deviceId: selectedMicrophone } : true
        });

        setStream(newStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }

        // Apply current audio/video states
        const audioTrack = newStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = isMicrophoneOn;
        }

        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = isCameraOn;
        }
        
        //console.log('Camera changed successfully');
      } catch (error) {
        console.error('Error changing camera:', error);
      }
    }
  };

  // Handle microphone change
  const handleMicrophoneChange = async (deviceId) => {
    //console.log('Changing microphone to:', deviceId);
    setSelectedMicrophone(deviceId);
    
    // If we already have a stream and permission, restart it immediately
    if (stream && hasMediaPermission && userType) {
      try {
        // Stop current stream
        stream.getTracks().forEach(track => track.stop());
        
        // Start new stream with new microphone
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: selectedCamera ? { deviceId: selectedCamera } : true,
          audio: deviceId ? { deviceId: deviceId } : true
        });

        setStream(newStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }

        // Apply current audio/video states
        const audioTrack = newStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = isMicrophoneOn;
        }

        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = isCameraOn;
        }
        
        console.log('Microphone changed successfully');
      } catch (error) {
        console.error('Error changing microphone:', error);
      }
    }
  };

  // Simple doctor authentication - in production, this should be more secure
  const handleJoinAsDoctor = () => {
    // No manual code required: role is validated via token in the URL
    onJoinAsDoctor("Doctor");
  };

  const handleJoinAsPatient = () => {
    if (!isDoctorPresent) {
      setIsWaiting(true);
      alert("Por favor espere. El doctor aún no se ha conectado a la teleconsulta.");
      return;
    }
    if (patientName.trim()) {
      onJoinAsPatient(patientName.trim());
    } else {
      alert("Por favor ingrese su nombre.");
    }
  };

  useEffect(() => {
    if (isDoctorPresent && isWaiting) {
      setIsWaiting(false);
      alert("El doctor se ha conectado. Ahora puede ingresar a la teleconsulta.");
    }
  }, [isDoctorPresent, isWaiting]);

  return (
    <div className={`waiting-room ${isModalMode ? 'modal-mode' : ''}`}>
      <div className="waiting-room-container">
        <div className="header-section">
          <h1>
            <span className="meet-icon"></span>
            Videoconsulta Médica
          </h1>
        </div>
        {userType && hasMediaPermission && (
          <div className="video-preview-section">
            <div className="video-container">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`video-preview ${!isCameraOn ? 'camera-off' : ''}`}
              />
              {!isCameraOn && (
                <div className="camera-off-placeholder">
                  <span className="camera-off-icon"><VideoOff size={30} strokeWidth={1.6} /></span>
                  <span>Cámara desactivada</span>
                </div>
              )}
            </div>
            
            <div className="media-controls">
              <button 
                className={`control-btn ${isCameraOn ? 'active' : 'inactive'}`}
                onClick={toggleCamera}
                title={isCameraOn ? 'Desactivar cámara' : 'Activar cámara'}
              >
                <span className="control-icon">
                  {isCameraOn ? <Video size={20} strokeWidth={2} /> : <VideoOff size={20} strokeWidth={2} />}
                </span>
              </button>
              <button 
                className={`control-btn ${isMicrophoneOn ? 'active' : 'inactive'}`}
                onClick={toggleMicrophone}
                title={isMicrophoneOn ? 'Desactivar micrófono' : 'Activar micrófono'}
              >
                <span className="control-icon">
                  {isMicrophoneOn ? <Mic size={20} strokeWidth={2} /> : <MicOff size={20} strokeWidth={2} />}
                </span>
              </button>
            </div>

            <div className="device-settings">
              <div className="setting-group">
                <label htmlFor="camera-select">
                  <span className="setting-icon"><Video size={16} strokeWidth={2} /></span>
                  Cámara
                </label>
                <select 
                  id="camera-select"
                  value={selectedCamera} 
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="device-select"
                >
                  {cameras.map(camera => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Cámara ${cameras.indexOf(camera) + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting-group">
                <label htmlFor="mic-select">
                  <span className="setting-icon"><Mic size={16} strokeWidth={2} /></span>
                  Micrófono
                </label>
                <select 
                  id="mic-select"
                  value={selectedMicrophone} 
                  onChange={(e) => handleMicrophoneChange(e.target.value)}
                  className="device-select"
                >
                  {microphones.map(mic => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Micrófono ${microphones.indexOf(mic) + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {!hasMediaPermission && userType && (
          <div className="permission-request">
            <div className="permission-icon"><Lock size={40} strokeWidth={1.6} /></div>
            <h3>Se necesita acceso a cámara y micrófono</h3>
            <p>Para continuar, permita el acceso a su cámara y micrófono cuando su navegador se lo solicite.</p>
            <button className="btn btn-primary" onClick={getMediaDevices}>
              Solicitar permisos
            </button>
          </div>
        )}
        {userType === "doctor" && (
          <div className="doctor-login">
            <div className="login-card">
              <div className="card-header">
                <span className="card-icon"><Stethoscope size={40} strokeWidth={1.6} /></span>
                <h2>Acceso Médico</h2>
                <p>Inicie la consulta cuando esté listo. Asegúrese de permitir cámara y micrófono.</p>
              </div>
              <div className="button-group vertical">
                <button
                  className="btn btn-primary large"
                  onClick={handleJoinAsDoctor}
                  disabled={!hasMediaPermission}
                >
                  {hasMediaPermission ? "Iniciar Teleconsulta" : "Permita cámara y micrófono"}
                </button>
              </div>
            </div>
          </div>
        )}

        {userType === "patient" && (
          <div className="patient-login">
            <div className="login-card">
              <div className="card-header">
                <span className="card-icon"><User size={40} strokeWidth={1.6} /></span>
                <h2>Acceso del Paciente</h2>
                <p>Ingrese sus datos para unirse a la consulta</p>
              </div>
              
              {!isDoctorPresent && (
                <div className="waiting-message modern">
                  <div className="waiting-icon"><Clock size={32} strokeWidth={1.6} /></div>
                  <h3>Esperando al doctor</h3>
                  <p>El doctor aún no se ha conectado. Por favor, espere un momento.</p>
                  <div className="loading-spinner modern"></div>
                </div>
              )}
              
              <div className="form-group">
                <label htmlFor="patient-name">
                  <span className="input-icon"><User size={16} strokeWidth={2} /></span>
                  Nombre completo
                </label>
                <input
                  id="patient-name"
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Ingrese su nombre completo"
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinAsPatient()}
                  disabled={!isDoctorPresent}
                  className="professional-input"
                />
              </div>
              
              <div className="button-group vertical">
                <button 
                  className="btn btn-primary large" 
                  onClick={handleJoinAsPatient}
                  disabled={!isDoctorPresent || !patientName.trim()}
                >
                  {isDoctorPresent ? "Ingresar a Consulta" : "Esperando al Doctor..."}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="info-section modern">
          <div className="info-header">
            <span className="info-icon"><Info size={20} strokeWidth={1.8} /></span>
            <h3>Información Importante</h3>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="item-icon"><Wifi size={18} strokeWidth={1.8} /></span>
              <span>Conexión estable a internet requerida</span>
            </div>
            <div className="info-item">
              <span className="item-icon"><Volume size={18} strokeWidth={1.8} /></span>
              <span>Verifique cámara y micrófono</span>
            </div>
            <div className="info-item">
              <span className="item-icon"><Stethoscope size={18} strokeWidth={1.8} /></span>
              <span>El doctor debe iniciar primero</span>
            </div>
            <div className="info-item">
              <span className="item-icon"><ShieldCheck size={18} strokeWidth={1.8} /></span>
              <span>Consulta completamente privada</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;