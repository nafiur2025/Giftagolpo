import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAZh8_lw_gC9dgEnAjMfxweBqI_qwZJ9Cg",
  authDomain: "giftagolpo.firebaseapp.com",
  projectId: "giftagolpo",
  storageBucket: "giftagolpo.firebasestorage.app",
  messagingSenderId: "273673707867",
  appId: "1:273673707867:web:4d6f5e4ff75889e0e6fa7e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
