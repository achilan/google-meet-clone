import firebase from "firebase";
// Read config from environment variables. In Create React App, env vars must be prefixed with REACT_APP_
const { REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_DATABASE_URL, REACT_APP_API_KEY } = process.env;

// Export a mutable flag so other modules can know there was an init issue.
export let firebaseInitError = false;

if (!REACT_APP_FIREBASE_API_KEY) {
  // Don't throw here to avoid unhandled exceptions during module import (which show the dev overlay).
  try {
    if (typeof window !== 'undefined' && window.alert) {
      window.alert('Falta la variable de entorno REACT_APP_FIREBASE_API_KEY. Por favor añade una API key válida en .env');
    }
  } catch (e) {
    // ignore
  }
  console.error('Missing REACT_APP_FIREBASE_API_KEY environment variable');
  firebaseInitError = true;
}

var firebaseConfig = {
  apiKey: REACT_APP_FIREBASE_API_KEY,
  databaseURL: REACT_APP_FIREBASE_DATABASE_URL || "https://videoconference-e4301-default-rtdb.firebaseio.com"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

export const db = firebase;
const generaterandomname = () => {
  const randomnumber = Math.floor(Math.random() * 1000);
  return "user" + randomnumber;
}
var firepadRef = firebase.database().ref();
const urlparams = new URLSearchParams(window.location.search);
const roomId = urlparams.get("id") || urlparams.get("cid");
const key = urlparams.get("key");
if (!key) {
  window.alert("No key provided in URL. Please provide a valid key to join the room.");
  console.error("No key provided in URL");
  firebaseInitError = true;
}
if (key !== REACT_APP_API_KEY) {
  window.alert("Invalid key provided in URL. Access denied.");
  console.error("Invalid key provided in URL");
  firebaseInitError = true;
}
const name = urlparams.get("name");
const ishost = urlparams.get("host");
export const userName = name? name : generaterandomname();

if (roomId) {
  firepadRef = firepadRef.child(roomId);
} else {
  firepadRef = firepadRef.push();
  window.history.replaceState(null, "Meet", "?id=" + firepadRef.key);
}
if (ishost) {
  firepadRef.child("host").set(userName);
}
export default firepadRef;