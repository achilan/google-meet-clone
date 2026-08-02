import {
  SET_MAIN_STREAM,
  ADD_PARTICIPANT,
  SET_USER,
  REMOVE_PARTICIPANT,
  UPDATE_USER,
  UPDATE_PARTICIPANT,
  SET_BACKGROUND_STREAM,
  SET_BACKGROUND_PICTURE,
} from "./actiontypes";

import {
  createOffer,
  initializeListensers,
  updatePreference,
} from "../server/peerConnection";

let defaultUserState = {
  mainStream: null,
  participants: {},
  currentUser: null,
  background: false,
  className: "",
};

const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
        "stun:stun.services.mozilla.com",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

const generateColor = () =>
  "#" + Math.floor(Math.random() * 16777215).toString(16);

export const userReducer = (state = defaultUserState, action) => {
  if (action.type === SET_MAIN_STREAM) {
    let payload = action.payload;
    state = { ...state, ...payload };
    return state;
  } else if (action.type === ADD_PARTICIPANT) {
    let payload = action.payload;
    const currentUserId = Object.keys(state.currentUser)[0];
    const newUserId = Object.keys(payload.newUser)[0];
    if (state.mainStream && currentUserId !== newUserId) {
      payload.newUser = addConnection(
        payload.newUser,
        state.currentUser,
        state.mainStream,
        state.background
      );
    }
    if (currentUserId === newUserId)
    payload.newUser[newUserId].currentUser = true;
    payload.newUser[newUserId].avatarColor = generateColor();
    /* payload.newUser[newUserId].background = state.background; */

    let participants = { ...state.participants, ...payload.newUser };
    state = { ...state, participants };
    return state;
  } else if (action.type === SET_USER) {
    let payload = action.payload;
    let participants = { ...state.participants };
    const userId = Object.keys(payload.currentUser)[0];
    payload.currentUser[userId].avatarColor = generateColor();
    payload.currentUser[userId].background = state.background;
    payload.currentUser[userId].className = state.className
    initializeListensers(userId);
    state = { ...state, currentUser: { ...payload.currentUser }, participants };
    return state;
  } else if (action.type === REMOVE_PARTICIPANT) {
    let payload = action.payload;
    let participants = { ...state.participants };
    delete participants[payload.id];
    state = { ...state, participants };
    return state;
  } else if (action.type === UPDATE_USER) {
    let payload = action.payload;
    // Puede dispararse antes de que exista el usuario actual (efectos del footer
    // al montar): ignorar en ese caso para no romper el store.
    if (!state.currentUser) return state;
    const userId = Object.keys(state.currentUser)[0];
    if (!userId) return state;
    updatePreference(userId, payload.currentUser);
    state.currentUser[userId] = {
      ...state.currentUser[userId],
      ...payload.currentUser,
      ...state.background
    };
    state.currentUser[userId].background = state.background;
    if (state.participants[userId]) {
      state.participants[userId].className = state.className;
    }
    state = {
      ...state,
      currentUser: { ...state.currentUser },
    };
    return state;
  } else if (action.type === UPDATE_PARTICIPANT) {
    let payload = action.payload;
    const newUserId = Object.keys(payload.newUser)[0];
    
    // No mezclar el estado de background del usuario actual con participantes remotos
    payload.newUser[newUserId] = {
      ...state.participants[newUserId],
      ...payload.newUser[newUserId]
      // Removido: ...state.background - esto causaba que el background del usuario actual se aplicara a todos
    };
    
    let participants = { ...state.participants, ...payload.newUser };
    state = { ...state, participants };
    return state;
  } else if (action.type === SET_BACKGROUND_STREAM) {
    let payload = action.payload;
    state = { ...state, ...payload };
    return state;
  } else if (action.type === SET_BACKGROUND_PICTURE) {
    let payload = action.payload;
    state = { ...state, ...payload };
    return state;
  }
  return state;
};

const addConnection = (newUser, currentUser, stream, background) => {
  const peerConnection = new RTCPeerConnection(servers);
  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream);
  });
  const newUserId = Object.keys(newUser)[0];
  const currentUserId = Object.keys(currentUser)[0];

  console.log(newUserId,currentUserId)

  const offerIds = [newUserId, currentUserId].sort((a, b) =>
    a.localeCompare(b)
  );

  newUser[newUserId].peerConnection = peerConnection;
  if (offerIds[0] !== currentUserId)
    createOffer(peerConnection, offerIds[0], offerIds[1], background);
  return newUser;
};
