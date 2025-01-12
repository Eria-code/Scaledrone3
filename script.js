// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// Replace with your own ScaleDrone channel ID
const drone = new ScaleDrone("LfHgHvcMx3uFQQIu");
// Room name needs to be prefixed with 'observable-'
const roomName = "observable-" + roomHash;

// WebRTC configuration with TURN servers
const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:your.turn.server:3478",
      username: "your-username",
      credential: "your-credential",
    },
  ],
};
let room;
let pc;

// Mute/unmute state
let isAudioMuted = false;
let isVideoMuted = false;

function onSuccess() {}
function onError(error) {
  console.error("Error:", error);
}

// Open ScaleDrone connection
drone.on("open", (error) => {
  if (error) {
    return console.error(error);
  }

  room = drone.subscribe(roomName);
  room.on("open", (error) => {
    if (error) {
      onError(error);
    }
  });

  room.on("members", (members) => {
    console.log("MEMBERS:", members);
    const isOfferer = members.length === 2;
    console.log("Is offerer:", isOfferer);
    startWebRTC(isOfferer);
  });
});

// Send signaling data via ScaleDrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message,
  });
}

// Start WebRTC connection
function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // Send ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate:", event.candidate);
      sendMessage({ candidate: event.candidate });
    } else {
      console.log("All ICE candidates sent.");
    }
  };

  // Handle incoming media stream
  pc.ontrack = (event) => {
    console.log("Track received:", event.streams[0]);
    remoteVideo.srcObject = event.streams[0];
  };

  // Add local media stream
  navigator.mediaDevices
    .getUserMedia({ audio: true, video: true })
    .then((stream) => {
      localVideo.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    })
    .catch(onError);

  // Handle signaling data
  room.on("data", (message, client) => {
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      console.log("Received SDP:", message.sdp);
      pc.setRemoteDescription(
        new RTCSessionDescription(message.sdp),
        () => {
          if (pc.remoteDescription.type === "offer") {
            pc.createAnswer().then(localDescCreated).catch(onError);
          }
        },
        onError
      );
    } else if (message.candidate) {
      console.log("Received ICE candidate:", message.candidate);
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate),
        onSuccess,
        onError
      );
    } else if (message.chat) {
      addChatMessage("Peer: " + message.chat);
    } else if (message.reaction) {
      showReaction(message.reaction);
    }
  });

  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer()
        .then(localDescCreated)
        .catch(onError);
    };
  }
}

// Handle local description creation
function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({ sdp: pc.localDescription }),
    onError
  );
}

// Chat functions
function addChatMessage(message) {
  const chatBox = document.getElementById("chatBox");
  const messageElement = document.createElement("div");
  messageElement.textContent = message;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
}

function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (message) {
    sendMessage({ chat: message });
    addChatMessage("You: " + message);
    input.value = "";
  }
}

// Emoji reactions
function sendReaction(reaction) {
  sendMessage({ reaction });
  showReaction(reaction, true);
}

function showReaction(reaction, isLocal = false) {
  const reactionBox = document.getElementById("reactionBox");
  const reactionElement = document.createElement("div");
  reactionElement.textContent = isLocal ? "You: " + reaction : reaction;
  reactionElement.className = "reaction";
  reactionBox.appendChild(reactionElement);
  setTimeout(() => reactionBox.removeChild(reactionElement), 2000); // Auto-remove after 2 seconds
}

// Mute/Unmute functions
function toggleAudio() {
  const audioTracks = localVideo.srcObject.getAudioTracks();
  isAudioMuted = !isAudioMuted;
  audioTracks.forEach((track) => (track.enabled = !isAudioMuted));
  document.getElementById("audioButton").textContent = isAudioMuted
    ? "Unmute Audio"
    : "Mute Audio";
}

function toggleVideo() {
  const videoTracks = localVideo.srcObject.getVideoTracks();
  isVideoMuted = !isVideoMuted;
  videoTracks.forEach((track) => (track.enabled = !isVideoMuted));
  document.getElementById("videoButton").textContent = isVideoMuted
    ? "Turn On Video"
    : "Turn Off Video";
}