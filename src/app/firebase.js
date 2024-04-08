import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Add this line

const firebaseConfig = {
    apiKey: "AIzaSyD17w0craWNMM8WmEJYnaKxdfCD0MJcNYI",
    authDomain: "flow-3c7aa.firebaseapp.com",
    projectId: "flow-3c7aa",
    storageBucket: "flow-3c7aa.appspot.com",
    messagingSenderId: "669632105817",
    appId: "1:669632105817:web:97433557a54bb7fe4ad048"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
