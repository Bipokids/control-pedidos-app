import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyAaUNfFrjKZKWATwGYUOXzzuXyiH81PyX8",
  authDomain: "despachos-bb558.firebaseapp.com",
  databaseURL: "https://despachos-bb558-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "despachos-bb558",
  storageBucket: "despachos-bb558.firebasestorage.app",
  messagingSenderId: "609069446908",
  appId: "1:609069446908:web:69efd4b60a56bba8018979"
};

const app = initializeApp(firebaseConfig);
export const db_realtime = getDatabase(app);
export const auth = getAuth(app);