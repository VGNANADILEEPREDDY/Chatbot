// Import Firebase modules - IMPORTANT: These imports are required for Firebase to handle API keys in the Canvas environment.
// These URLs point to specific Firebase SDK versions that are compatible with the Canvas environment.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// DOM element selections
const sendChatBtn = document.querySelector(".chat-input span");
const chatInput = document.querySelector(".chat-input textarea");
const chatBox = document.querySelector(".chatbox");
const chatBotToggler = document.querySelector(".chatbot-toggler");
const chatBotCloseBtn = document.querySelector(".close-btn");

// Global variables for chat state and API key.
// The API_KEY is intentionally left empty. When deployed in a Canvas environment,
// Canvas will automatically inject your configured Gemini API key here securely.
const API_KEY = "AIzaSyAJTMBs0RnsCXUItDDzLk98ooUDKA6zfQw";
let chatHistory = []; // Stores the entire conversation history for context

// --- Firebase Initialization (Required for Canvas API calls) ---
// These global variables (`__app_id`, `__firebase_config`, `__initial_auth_token`)
// are automatically provided by the Canvas environment at runtime.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app;
let auth;

/**
 * Initializes Firebase and authenticates the user.
 * This is crucial for making API calls through the secure Canvas proxy.
 */
async function initializeFirebase() {
    try {
        if (Object.keys(firebaseConfig).length > 0) {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);

            if (initialAuthToken) {
                // If a custom authentication token is provided (e.g., for authenticated users), use it.
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Firebase signed in with custom token.");
            } else {
                // Otherwise, sign in anonymously for basic API access.
                await signInAnonymously(auth);
                console.log("Firebase signed in anonymously.");
            }
        } else {
            console.warn("Firebase config not found. API calls might not work in some environments.");
        }
    } catch (error) {
        console.error("Error initializing Firebase or signing in:", error);
    }
}

// Call the Firebase initialization function when the script loads.
initializeFirebase();

/**
 * Creates a new chat list item (<li>) with the given message and class.
 * @param {string} message The text content of the message.
 * @param {string} className The class name ('outgoing' or 'incoming') for styling.
 * @returns {HTMLElement} The created <li> element.
 */
const createChatLi = (message, className) => {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", className);
    // Use the Font Awesome robot icon for incoming messages.
    let chatContent = className === 'outgoing' ? `<p>${message}</p>` :
        `<span class="fa-solid fa-robot"></span><p></p>`;
    chatLi.innerHTML = chatContent;
    // Set the text content of the paragraph element within the chat item.
    chatLi.querySelector("p").textContent = message;
    return chatLi;
};

/**
 * Generates a response from the Gemini API.
 * @param {HTMLElement} incomingChatLi The <li> element where the incoming message (bot's response) will be displayed.
 * @param {string} userMessage The user's most recent message to be added to the context.
 */
const generateResponse = async (incomingChatLi, userMessage) => {
    // Gemini API endpoint for the 'gemini-2.0-flash' model.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const messageElement = incomingChatLi.querySelector("p");

    // Add the user's message to the chat history before sending it to the API.
    // Gemini API expects content in a specific 'role' and 'parts' format.
    chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

    const payload = {
        contents: chatHistory, // Send the entire chat history for conversational context.
        // Optional: You can add `generationConfig` here for advanced settings,
        // like `temperature`, `maxOutputTokens`, `stopSequences`, etc.
        // For example:
        // generationConfig: {
        //     temperature: 0.7,
        //     maxOutputTokens: 200,
        // },
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Check if the network request was successful.
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const result = await response.json();

        // Parse the Gemini API response to extract the bot's message.
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const botResponse = result.candidates[0].content.parts[0].text;
            messageElement.textContent = botResponse;
            // Add the bot's response to the chat history for future context.
            chatHistory.push({ role: "model", parts: [{ text: botResponse }] });
        } else {
            messageElement.classList.add("error");
            messageElement.textContent = "Oops! Could not get a response from Gemini. Please try again.";
            console.error("Unexpected API response structure:", result);
        }
    } catch (error) {
        messageElement.classList.add("error");
        messageElement.textContent = "Oops! Something went wrong...Please try again.";
        console.error("Error generating response:", error);
    } finally {
        // Always scroll to the bottom of the chatbox to show the latest message.
        chatBox.scrollTo(0, chatBox.scrollHeight);
    }
};

/**
 * Handles the user's chat input:
 * 1. Retrieves and trims the message.
 * 2. Clears the input field and resets its height.
 * 3. Appends the user's message to the chatbox.
 * 4. Displays a "Thinking..." message.
 * 5. Calls `generateResponse` to get the bot's reply.
 */
const handleChat = () => {
    const userMessage = chatInput.value.trim(); // Get trimmed user message
    if (!userMessage) return; // Do nothing if the message is empty

    // Clear the input field and reset its height to auto.
    chatInput.value = "";
    chatInput.style.height = 'auto';

    // Append the user's message as an 'outgoing' chat bubble.
    chatBox.append(createChatLi(userMessage, 'outgoing'));
    chatBox.scrollTo(0, chatBox.scrollHeight); // Scroll to the latest message

    // Introduce a small delay before showing "Thinking..." and generating a response.
    setTimeout(() => {
        const incomingChatLi = createChatLi('Thinking....', 'incoming');
        chatBox.append(incomingChatLi);
        chatBox.scrollTo(0, chatBox.scrollHeight); // Scroll again to show "Thinking..."
        generateResponse(incomingChatLi, userMessage); // Call the API to get a response
    }, 600); // 600 milliseconds delay
};

// --- Event Listeners ---

// Event listener for the send chat button click.
sendChatBtn.onclick = () => {
    handleChat();
};

// Event listener for the chatbot toggler button (to show/hide the chatbot).
chatBotToggler.onclick = () => {
    document.body.classList.toggle('show-chatbot');
};

// Event listener for the close chatbot button.
chatBotCloseBtn.onclick = () => {
    document.body.classList.remove('show-chatbot');
};

// Event listener to dynamically adjust the textarea height as the user types.
chatInput.oninput = () => {
    chatInput.style.height = 'auto'; // Reset height to allow shrinkage if text is deleted.
    chatInput.style.height = `${chatInput.scrollHeight}px`; // Set height to fit content.
};

// Event listener for keyboard input in the textarea.
chatInput.onkeydown = (e) => {
    // If Enter is pressed (without Shift) and window width is greater than 800px (desktop),
    // prevent default Enter behavior (new line) and send the message.
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
        e.preventDefault();
        handleChat();
    }
};

// Initial adjustment for textarea height on page load (in case of pre-filled text).
chatInput.style.height = `${chatInput.scrollHeight}px`;