import firebase from "firebase";

var firebaseConfig = {
  apiKey: "AIzaSyDWhzVCbkhVXy2ZrHwKM6yf-xirj9s-UOo", // Add API Key
  databaseURL:"https://videoconference-e4301-default-rtdb.firebaseio.com" // Add databaseURL
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