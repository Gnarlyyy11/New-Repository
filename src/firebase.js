import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// 1. Idinagdag ang Messaging import
import { getMessaging } from "firebase/messaging"; 

const firebaseConfig = {
  apiKey: "AIzaSyCTUf87sgGcG6X8U_yZ_Nv9xL75jIAuyBs", 
  authDomain: "uson-credithub.firebaseapp.com",
  projectId: "uson-credithub",
  storageBucket: "uson-credithub.firebasestorage.app",
  messagingSenderId: "6735654601",
  appId: "1:6735654601:web:fda3104f0bff8a7f80a718",
  measurementId: "G-8BK5LWS5BF"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
// 2. ITO ANG IMPORTANTE: In-export ang messaging service
export const messaging = getMessaging(app);