import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB5IKLCilfjhycpn_lGwJyFpBd77p1twaA",
  authDomain: "smart-parking-dashboard-826f9.firebaseapp.com",
  databaseURL: "https://smart-parking-dashboard-826f9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-parking-dashboard-826f9",
  storageBucket: "smart-parking-dashboard-826f9.firebasestorage.app",
  messagingSenderId: "1062969390171",
  appId: "1:1062969390171:web:b7cca9d3452b594324bb7e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const rtdb = getDatabase(app);

export default app;