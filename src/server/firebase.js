import firebase from "firebase";

var firebaseConfig = {
  apiKey: "AIzaSyDWhzVCbkhVXy2ZrHwKM6yf-xirj9s-UOo", // Add API Key
  databaseURL:"https://videoconference-e4301-default-rtdb.firebaseio.com" // Add databaseURL
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

export const db = firebase;

var firepadRef = firebase.database().ref();
const urlparams = new URLSearchParams(window.location.search);
const roomId = urlparams.get("id");
const name = urlparams.get("name");
export const userName = name? name : prompt("Ingresa tu nombre");

if (roomId) {
  firepadRef = firepadRef.child(roomId);
} else {
  firepadRef = firepadRef.push();
  window.history.replaceState(null, "Meet", "?id=" + firepadRef.key);
}

export default firepadRef;