"use client"
import { useEffect, useState, useRef } from 'react';
import { db, auth } from "./firebase";
import { signInWithPopup, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, where, getDocs } from "firebase/firestore";


import ReactTimeAgo from 'react-time-ago'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
// TimeAgo.addDefaultLocale(en)


export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userPFP, setUserPFP] = useState("");
  const [userChats, setUserChats] = useState([]);
  const [currentChat, setCurrentChat] = useState("");
  const [currentChatMessages, setCurrentChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const messageInputRef = useRef(null);


  // Function to handle Google sign-in + store them in firestore
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection prompt
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      // Pass the provider to signInWithPopup to start the sign-in flow
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // Construct user info
      const userInfo = {
        name: user.displayName,
        email: user.email,
        phone: user.phoneNumber,
        pfp: user.photoURL,
      };

      // Check if user document exists
      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);
      // If user document does not exist, create one
      if (!docSnap.exists()) {
        await setDoc(userRef, userInfo);
      }
      // error handling
    } catch (error) {
      console.error("Authentication error:", error.message);
    }
  };
  // Function to handle logout
  const handleLogout = () => {
    auth.signOut().then(() => {
      // Sign-out successful.
      setIsLoggedIn(false);
    }).catch((error) => {
      // An error happened.
      console.error("Logout error:", error);
    });
  };
  //handle user state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserPFP(user.photoURL);
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUserPFP("");
      }
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);
  // Fetch user's chats and order by lastmessagetimestamp
  useEffect(() => {
    // Ensure there's a logged-in user
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Reference to the chats collection
    const chatsRef = collection(db, "chats");

    // Create a query against the collection for chats where the user is a member
    const q = query(chatsRef,
      where("members", "array-contains", currentUser.uid),
      orderBy("lastMessageTimestamp", "desc"));

    // Execute the query
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chats = [];
      querySnapshot.forEach((doc) => {
        chats.push({
          id: doc.id,
          ...doc.data()
        });
      });
      console.log('Chats updated:', chats); // Log to see if the updates are received
      setUserChats([...chats]); // Spread into a new array to ensure a new reference
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [auth.currentUser]); // Depend on auth.currentUser to re-run when the user logs in/out

  // Function to adjust message input height based on content
  const adjustTextAreaHeight = (element) => {
    const maxHeight = element.scrollHeight; // Maximum height before scrolling
    const singleRowHeight = 32; // Adjust based on your font size and padding
    const maxRowsHeight = singleRowHeight * 30; // Max height for 30 rows

    element.style.height = "auto"; // Reset height to recalculate
    const desiredHeight = Math.max(element.scrollHeight, singleRowHeight); // Calculate desired height
    element.style.height = `${Math.min(desiredHeight, maxRowsHeight)}px`; // set input height

    // Enable or disable scrolling based on content height
    element.style.overflowY = (element.scrollHeight > maxRowsHeight) ? "auto" : "hidden";
  };
  // Adjust message input height on content change
  useEffect(() => {
    if (messageInputRef.current) {
      adjustTextAreaHeight(messageInputRef.current);
    }
  });


  // Function to create a new chat + set to current chat
  const createNewChat = async () => {
    // Ensure the user is logged in and current chat isn't already a new chat
    if (auth.currentUser && currentChatMessages.length !== 0) {
      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("members", "array-contains", auth.currentUser.uid));

      try {
        const querySnapshot = await getDocs(q);
        let newChatExists = false; // Flag to indicate if a new chat exists

        querySnapshot.forEach((doc) => {
          const chatData = doc.data();
          // Check if this chat is a new chat
          if (chatData.members.length === 1 && !chatData.lastMessageTimestamp) {
            // Found new chat, set flag to true
            newChatExists = true;
            setCurrentChat(doc.id); // Set this chat as the current chat
            console.log("Existing new chat found and set as current:", doc.id);
          }
        });

        if (!newChatExists) {
          // If no "new chat" was found, create one
          const chatRef = await addDoc(collection(db, "chats"), {
            members: [auth.currentUser.uid], // Add current user as a member
          });
          setCurrentChat(chatRef.id); // Update local state to reflect the new chat as the current chat
          console.log("New chat created:", chatRef.id);
        }
      } catch (error) {
        console.error("Error creating new chat:", error);
      }
    } else {
      console.log("User not logged in or current chat already a new chat");
    }
  };


  // stream current chat's messages to currentChatMessages
  useEffect(() => {
    if (!currentChat) return;

    const q = query(collection(db, "chats", currentChat, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCurrentChatMessages(messages);
    });

    return () => unsubscribe();
  }, [currentChat]);
  // Save current chat to local storage
  useEffect(() => {
    if (currentChat) {
      localStorage.setItem('currentChat', currentChat);
    }
  }, [currentChat]);
  // Load current chat from local storage, create a new chat if cant find it or not a member of it
  useEffect(() => {
    const fetchChatAndSetIfMember = async () => {
      if (!auth.currentUser) return; // No logged-in user
      const savedChatId = localStorage.getItem('currentChat');
      if (!savedChatId) { // No saved chat, create new chat
        createNewChat();
        return;
      }

      try {
        const chatRef = doc(db, "chats", savedChatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          // Check if the current user is a member of the chat
          if (chatData.members.includes(auth.currentUser.uid)) {
            setCurrentChat(savedChatId); // User is a member, set as current chat
          } else {
            console.log("Current user is not a member of the saved chat");
            createNewChat(); // User not a member, create a new chat
          }
        } else {
          console.log("Saved chat does not exist");
          createNewChat(); // Saved chat does not exist, create a new chat
        }
      } catch (error) {
        console.error("Error fetching chat document:", error);
      }
    };
    fetchChatAndSetIfMember();
  }, [auth.currentUser]); // Re-run when the user logs in/out


  // Function to handle sending a message
  const handleSendMessage = async () => {
    const messageText = messageInput.trim();
    if (messageText === "") return; // Don't send empty messages

    setMessageInput(""); // Clear the input field
    adjustTextAreaHeight(messageInputRef.current); // Reset the input height

    try {
      let chatId = currentChat;

      // If there's no current chat, create a new chat
      if (!chatId) {
        const chatRef = await addDoc(collection(db, "chats"), {
          members: [auth.currentUser.uid], // Initially, add current user as a member
        });
        chatId = chatRef.id; // Set the newly created chat ID
        setCurrentChat(chatId); // Update the current chat context
      }

      // Timestamp for the message and the last message in chat
      const timestamp = new Date();

      // Send message to the chat
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        content: messageText,
        timestamp: timestamp,
        sender: auth.currentUser.uid,
      });

      // Update the chat's lastMessageTimestamp
      await setDoc(doc(db, "chats", chatId), {
        lastMessageTimestamp: timestamp,
      }, { merge: true });

    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent the default action to avoid form submission or newline in textarea
      handleSendMessage(); // Call your send message function
    }
  };



  if (isLoading) { // loading screen
    return (
      <div className="select-none h-screen w-screen overflow-hidden font-helvetica uppercase">
        <div className='h-full w-full flex flex-col justify-center items-center'>
          {/* app title */}
          < div className="text-[10vh] lg:text-[20vh] leading-none text-center" >
            flow chat
          </div >
          {/* glyphteck studio */}
          <div className="text-[3vh] lg:text-[5vh] leading-none" >
            by glyphteck studios
          </div>
        </div>
      </div>
    );
  } else if (!isLoggedIn) { // login screen
    return (
      <div className="select-none h-screen w-screen overflow-hidden font-helvetica uppercase">
        {/* bg video */}
        <video autoPlay muted loop playsInline className='z-[-1]  absolute top-0 left-0 w-full h-full object-cover'>
          <source src="flow.mp4" type="video/mp4" />
        </video>
        <div className='py-[10vh] h-full w-full flex flex-col justify-center items-center'>

          {/* app title */}
          <div className="text-[10vh] md:text-[20vh] leading-none text-center" >
            flow chat
          </div>
          <div className='h-[8vh]'></div>
          {/* login button */}
          <div onClick={handleGoogleSignIn} className="shadow-bottomshadow px-[24px] py-[16px] md:px-[48px] md:py-[24px] rounded-full cursor-pointer leading-none flex flex-row bg-black bg-opacity-30 backdrop-blur-lg" >
            <img src="/google.png" className="w-[3vh] h-[3vh] md:w-[5vh] md:h-[5vh] inline-block" />
            <div className='w-[16px] md:w-[32px]'></div>
            <div className='text-[3vh] md:text-[5vh]'>Sign in</div>
          </div>
        </div>
      </div>
    )
  } else if (isLoggedIn) { // main app
    return (
      <main className='h-screen w-screen overflow-hidden'>
        {/* main ui */}
        <div className='h-full w-full grid grid-rows-1 grid-cols-[400px_minmax(0,1fr)]'>
          {/* chats list section */}
          <div className='select-none z-20 relative h-full bg-[#111] shadow-rightshadow'>
            {/* search bar */}
            <div className='absolute w-full px-[24px] py-[12px]'>
              <input
                placeholder="Search"
                type='text'
                className='cursor-pointer px-[24px] py-[12px] w-full bg-black bg-opacity-40 backdrop-blur-xl outline-none shadow-bottomshadow' />
            </div>
            {/* chats list */}
            <div className='pt-[80px] flex flex-col h-full overflow-y-scroll scrollbar-hide font-helvetica uppercase'>
              {userChats.map((chat) => (
                <div
                  onClick={() => setCurrentChat(chat.id)}
                  key={chat.id}
                  className="cursor-pointer py-[16px] border-black border-b-[1px] w-full flex items-center justify-center"
                >
                  {chat.id}
                </div>
              ))}
            </div>
          </div>
          {/* on going chat */}
          <div className='relative h-full w-full'>
            {/* navbar */}
            <div className='select-none absolute w-full px-[32px] py-[16px] font-helvetica uppercase text-4xl flex flex-row justify-between items-center bg-[#0c0c0c] bg-opacity-70 backdrop-blur-lg shadow-bottomshadow'>
              <div className='flex flex-row justify-center items-center'>
                <img onClick={createNewChat} src="newchat.png" className="cursor-pointer h-[32px] w-[32px]"></img>
              </div>
              {/* glyphteck + menu */}
              <div className='flex flex-row justify-center items-center'>
                <a href="https://glyphteck.com/" target="_blank" rel="noopener noreferrer" className="leading-none">glyphteck</a>
                <div className='pr-[42px]'></div>
                <img src={userPFP} alt="User Profile" className="cursor-pointer rounded-full w-[48px] h-[48px]" onClick={handleLogout} />
              </div>
            </div>
            {/* messages */}
            <div className='pt-[90px] pb-[152px] bg-[#1b1b1b] flex flex-col h-full w-full overflow-y-scroll scrollbar-hide'>
              {/* messages */}
              {currentChatMessages.map((message, i) => (
                <div key={i} className="px-8 py-6 border-black border-b-[1px] flex flex-row">
                  {message.sender === auth.currentUser.uid ? (
                    <div className="w-1/2"></div> // This empty div pushes the message to the right half if it's from the current user
                  ) : null}
                  <div className={`w-1/2 break-words ${message.sender === auth.currentUser.uid ? 'text-right' : 'text-left'}`}>
                    {message.content}
                  </div>
                  {message.sender !== auth.currentUser.uid ? (
                    <div className="w-1/2"></div> // This empty div is not really needed unless you want to ensure the structure is symmetrical
                  ) : null}
                </div>
              ))}
            </div>
            {/* input */}
            <div className='z-40 absolute bottom-[48px] left-1/2 transform -translate-x-1/2 w-full flex justify-center items-center'>
              <div className='px-[24px] py-[12px] w-[70%] bg-black bg-opacity-40 backdrop-blur-xl shadow-bottomshadow flex items-center justify-center'>
                <textarea
                  rows="1"
                  ref={messageInputRef}
                  onKeyDown={handleKeyDown}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Message..."
                  type='text'
                  className='w-full bg-transparent overflow-hidden resize-none cursor-pointer rounded-md outline-none scrollbar-hide' />
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }
}
