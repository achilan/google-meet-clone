import MainScreen from "./components/MainScreen/MainScreen.component";
import WaitingRoom from "./components/WaitingRoom/WaitingRoom.component";
import firepadRef, { db, firebaseInitError } from "./server/firebase";
import "./App.css";
import { useEffect, useState } from "react";
import {
  setMainStream,
  addParticipant,
  setUser,
  removeParticipant,
  updateParticipant,
} from "./store/actioncreator";
import { connect } from "react-redux";

function App(props) {
  const [hasJoined, setHasJoined] = useState(false);
  const [isDoctorPresent, setIsDoctorPresent] = useState(false);
  const [currentUserType, setCurrentUserType] = useState("");
  const [currentUserKey, setCurrentUserKey] = useState(null);
  
  const getUserStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      return stream;
    } catch (err) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      return stream;
    }
  };
  useEffect(async () => {
    if (!hasJoined) return;
    if (firebaseInitError) {
      console.error('Firebase not initialized correctly; skipping join flow');
      return;
    }
    
    // Clean up existing user data if reconnecting
    if (currentUserKey) {
      try {
        await participantRef.child(currentUserKey).remove();
      } catch (error) {
        console.log("No previous user to remove");
      }
    }
    
    const stream = await getUserStream();
    console.log(stream);
    if (stream.getVideoTracks().length > 0) {
      stream.getVideoTracks()[0].enabled = false;
    }
    props.setMainStream(stream);
    
    const connectionHandler = (snap) => {
      if (snap.val() && !currentUserKey) {
        const defaultPreference = {
          audio: true,
          video: false,
          screen: false,
          background: false,
          className: "",
        };
        
        // Check if user already exists with same name and type
        participantRef.once('value', (participantsSnapshot) => {
          const existingParticipants = participantsSnapshot.val();
          let shouldCreateNewUser = true;
          
          if (existingParticipants) {
            // Check for duplicate user
            Object.keys(existingParticipants).forEach(key => {
              const participant = existingParticipants[key];
              if (participant.userName === window.userName && 
                  participant.userType === currentUserType) {
                // User already exists, don't create duplicate
                shouldCreateNewUser = false;
                setCurrentUserKey(key);
                props.setUser({
                  [key]: { name: window.userName, ...defaultPreference, userType: currentUserType },
                });
              }
            });
          }
          
          if (shouldCreateNewUser) {
            const userStatusRef = participantRef.push({
              userName: window.userName,
              preferences: defaultPreference,
              userType: currentUserType,
              timestamp: Date.now(), // Add timestamp for uniqueness
            });
            
            setCurrentUserKey(userStatusRef.key);
            props.setUser({
              [userStatusRef.key]: { name: window.userName, ...defaultPreference, userType: currentUserType },
            });
            userStatusRef.onDisconnect().remove();
          }
        });
      }
    };
    
  connectedRef.on("value", connectionHandler);
    
    // Cleanup function
    return () => {
      connectedRef.off("value", connectionHandler);
    };
  }, [hasJoined, currentUserType]);

  const connectedRef = !firebaseInitError ? db.database().ref(".info/connected") : null;
  const participantRef = !firebaseInitError ? firepadRef.child("participants") : null;
  
  // Monitor for doctor presence
  useEffect(() => {
    if (firebaseInitError || !participantRef) {
      setIsDoctorPresent(false);
      return;
    }

    participantRef.on("value", (snapshot) => {
      const participants = snapshot.val();
      if (participants) {
        const doctorPresent = Object.values(participants).some(
          participant => participant.userType === "doctor"
        );
        setIsDoctorPresent(doctorPresent);
      } else {
        setIsDoctorPresent(false);
      }
    });

    return () => {
      participantRef.off();
    };
  }, []);
  
  const handleJoinAsDoctor = (doctorName) => {
    if (firebaseInitError) {
      alert('No es posible unirse: error de inicialización del servidor. Contacte al administrador.');
      return;
    }
    window.userName = doctorName;
    setCurrentUserType("doctor");
    setHasJoined(true);
  };
  
  const handleJoinAsPatient = (patientName) => {
    if (firebaseInitError) {
      alert('No es posible unirse: error de inicialización del servidor. Contacte al administrador.');
      return;
    }
    window.userName = patientName;
    setCurrentUserType("patient");
    setHasJoined(true);
  };
  
  // Cleanup function when component unmounts or user leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUserKey) {
        // Remove user from Firebase when leaving
        participantRef.child(currentUserKey).remove();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Clean up on component unmount
      if (currentUserKey) {
        participantRef.child(currentUserKey).remove();
      }
    };
  }, [currentUserKey]);

  const isUserSet = !!props.user;
  const isStreamSet = !!props.stream;

  useEffect(() => {
    if (isStreamSet && isUserSet) {
      const childAddedHandler = (snap) => {
        const participantData = snap.val();
        if (!participantData) return;
        
        // Check if this participant is already in our state to prevent duplicates
        const existingParticipant = props.participants[snap.key];
        if (existingParticipant) {
          console.log("Participant already exists, skipping:", snap.key);
          return;
        }
        
        const preferenceUpdateEvent = participantRef
          .child(snap.key)
          .child("preferences");
        preferenceUpdateEvent.on("child_changed", (preferenceSnap) => {
          props.updateParticipant({
            [snap.key]: {
              [preferenceSnap.key]: preferenceSnap.val(),
            },
          });
        });
        
        const { userName: name, preferences = {}, userType } = participantData;
        props.addParticipant({
          [snap.key]: {
            name,
            userType,
            ...preferences,
          },
        });
      };
      
      const childRemovedHandler = (snap) => {
        props.removeParticipant(snap.key);
      };
      
      participantRef.on("child_added", childAddedHandler);
      participantRef.on("child_removed", childRemovedHandler);
      
      // Cleanup function
      return () => {
        participantRef.off("child_added", childAddedHandler);
        participantRef.off("child_removed", childRemovedHandler);
      };
    }
  }, [isStreamSet, isUserSet]);

  return (
    <div className="App">
      {firebaseInitError && (
        <div style={{background: '#ffe6e6', color: '#800', padding: 12, textAlign: 'center', position: 'fixed', top: 0, width: '100%', zIndex: 1000}}>
          <strong>Problema de configuración:</strong> No se pudo inicializar la conexión con Firebase. Algunas funcionalidades estarán deshabilitadas. Contacte al administrador.
        </div>
      )}
      {!hasJoined ? (
        <WaitingRoom 
          onJoinAsDoctor={handleJoinAsDoctor}
          onJoinAsPatient={handleJoinAsPatient}
          isDoctorPresent={isDoctorPresent}
        />
      ) : (
        <MainScreen />
      )}
    </div>
  );
}

const mapStateToProps = (state) => {
  return {
    stream: state.mainStream,
    user: state.currentUser,
    participants: state.participants,
    background: state.background,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setMainStream: (stream) => dispatch(setMainStream(stream)),
    addParticipant: (user) => dispatch(addParticipant(user)),
    setUser: (user) => dispatch(setUser(user)),
    removeParticipant: (userId) => dispatch(removeParticipant(userId)),
    updateParticipant: (user) => dispatch(updateParticipant(user)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
