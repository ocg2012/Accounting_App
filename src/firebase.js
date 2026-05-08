// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBMJZ2nk8nHIK7W-OMI-pqAEZJzj6v_Foc",
  authDomain: "accounting-app-78ffe.firebaseapp.com",
  projectId: "accounting-app-78ffe",
  storageBucket: "accounting-app-78ffe.firebasestorage.app",
  messagingSenderId: "860165021838",
  appId: "1:860165021838:web:b43beb4dff447fac54e9df",
  measurementId: "G-D43747N386"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);