// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// Replace with your own ScaleDrone channel ID
const drone = new ScaleDrone("y0N6q0oVsjY9fEiu");
// Room name needs to be prefixed with 'observable-'
const roomName = "observable-" + roomHash;

// WebRTC configuration
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
let room;
let pc;

// Mute/unmute state
let isAudioMuted = false;
let isVideoMuted = false;

function onSuccess() {}
function onError(error) {
  console.error(error);
}

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
    console.log("MEMBERS", members);
    const isOfferer = members.length === 2;
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

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessage({ candidate: event.candidate });
    }
  };

  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    };
  }

  pc.onaddstream = (event) => {
    remoteVideo.srcObject = event.stream;
  };

  navigator.mediaDevices
    .getUserMedia({ audio: true, video: true })
    .then((stream) => {
      localVideo.srcObject = stream;
      pc.addStream(stream);
    }, onError);

  room.on("data", (message, client) => {
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
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
}

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