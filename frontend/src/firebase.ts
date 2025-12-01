// frontend/src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBGOBR9eH7I4L6zSGQ9N9SbOgOB6V9B-YQ",
  authDomain: "moodmixer-6bb54.firebaseapp.com",
  projectId: "moodmixer-6bb54",
  storageBucket: "moodmixer-6bb54.appspot.com",
  messagingSenderId: "228666327310",
  appId: "1:228666327310:android:b926a0a97d75033223575f",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
