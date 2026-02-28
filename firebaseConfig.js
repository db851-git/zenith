import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
    getReactNativePersistence,
    initializeAuth
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// REPLACE WITH YOUR KEYS
const firebaseConfig = {
  apiKey: "AIzaSyBVQyAb_TyEX_HmUiV1LMmoNPAv53F097o",
  authDomain: "zenith-mobile-c57ec.firebaseapp.com",
  projectId: "zenith-mobile-c57ec",
  storageBucket: "zenith-mobile-c57ec.firebasestorage.app",
  messagingSenderId: "914755215467",
  appId: "1:914755215467:web:2f114adf43929c79ccd12e",
  measurementId: "G-5D295SE15Q",
};

const app = initializeApp(firebaseConfig);

// This fixes the "Auth" errors on Android
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);

export { auth, db };
