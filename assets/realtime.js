// Realtime Synchronization Engine
// Mendukung: Instant Cloud Sync (MQTT over WebSocket TLS), Firebase Realtime DB, dan BroadcastChannel lokal.

const RealtimeSync = (function() {
  const DEFAULT_ROOM = "TRANSITION-2026";
  const MQTT_BROKER = "broker.emqx.io";
  const MQTT_PORT = 8084; // Secure WSS port
  const MQTT_PATH = "/mqtt";

  let currentRoom = DEFAULT_ROOM;
  let userRole = "player"; // 'player' atau 'host'
  let mqttClient = null;
  let isConnected = false;
  let listeners = {
    onSubmission: null,
    onPresence: null,
    onStatusChange: null,
    onHostAction: null
  };
  let localChannel = null;
  let presenceInterval = null;
  let onlineParticipants = new Map();

  // Ambil Room ID dari URL param (?room=XYZ) atau localStorage
  function resolveRoomId() {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl && roomFromUrl.trim()) {
      return roomFromUrl.trim().toUpperCase();
    }
    const saved = localStorage.getItem('active_quiz_room');
    if (saved) return saved;
    return DEFAULT_ROOM;
  }

  function saveLocalSubmission(sub) {
    try {
      const key = `submissions_${currentRoom}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      // Cek apakah id submission sudah ada
      const idx = list.findIndex(s => s.id === sub.id);
      if (idx >= 0) {
        list[idx] = sub;
      } else {
        list.push(sub);
      }
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.warn("Storage save error", e);
    }
  }

  function getLocalSubmissions() {
    try {
      const key = `submissions_${currentRoom}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      return [];
    }
  }

  // Setup BroadcastChannel untuk multi-tab langsung di perangkat yang sama
  function setupBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      try {
        localChannel = new BroadcastChannel(`quiz_${currentRoom}`);
        localChannel.onmessage = (event) => {
          handleIncomingMessage(event.data);
        };
      } catch (e) {
        console.warn("BroadcastChannel error:", e);
      }
    }
  }

  // Handle incoming data universal
  function handleIncomingMessage(payload) {
    if (!payload || !payload.type) return;

    if (payload.type === 'submission') {
      saveLocalSubmission(payload.data);
      if (listeners.onSubmission) {
        listeners.onSubmission(payload.data);
      }
    } else if (payload.type === 'presence') {
      const p = payload.data;
      onlineParticipants.set(p.clientId, {
        name: p.name,
        role: p.role,
        lastSeen: Date.now()
      });
      prunePresence();
      if (listeners.onPresence) {
        listeners.onPresence(onlineParticipants.size, Array.from(onlineParticipants.values()));
      }
    } else if (payload.type === 'host_action') {
      if (listeners.onHostAction) {
        listeners.onHostAction(payload.data);
      }
    }
  }

  function prunePresence() {
    const now = Date.now();
    for (const [id, data] of onlineParticipants.entries()) {
      if (now - data.lastSeen > 30000) { // 30 detik tanpa ping = offline
        onlineParticipants.delete(id);
      }
    }
  }

  // Setup MQTT over WebSocket (Cloud Realtime tanpa konfigurasi)
  function setupMQTT() {
    if (typeof Paho === 'undefined' || !Paho.MQTT) {
      console.warn("Paho MQTT client belum termuat, beralih ke fallback mode.");
      updateStatus(false, "Mode Lokal / Offline");
      return;
    }

    const clientId = `quiz_${userRole}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      mqttClient = new Paho.MQTT.Client(MQTT_BROKER, MQTT_PORT, MQTT_PATH, clientId);

      mqttClient.onConnectionLost = (responseObject) => {
        isConnected = false;
        updateStatus(false, "Terputus, mencoba koneksi ulang...");
        if (responseObject.errorCode !== 0) {
          console.warn("MQTT connection lost:", responseObject.errorMessage);
        }
        setTimeout(setupMQTT, 4000);
      };

      mqttClient.onMessageArrived = (message) => {
        try {
          const payload = JSON.parse(message.payloadString);
          handleIncomingMessage(payload);
        } catch (e) {
          console.warn("Failed to parse incoming MQTT payload", e);
        }
      };

      updateStatus(false, "Menghubungkan ke Cloud Room...");

      mqttClient.connect({
        useSSL: true,
        timeout: 10,
        keepAliveInterval: 30,
        cleanSession: true,
        onSuccess: () => {
          isConnected = true;
          updateStatus(true, `Terhubung ke Cloud (Room: ${currentRoom})`);
          
          // Subscribe ke room topic
          const topic = `antigravity/quiz/${currentRoom}/#`;
          mqttClient.subscribe(topic, { qos: 1 });
          console.log("📡 Terhubung ke topic:", topic);

          // Mulai presence heartbeat
          startPresenceHeartbeat(clientId);
        },
        onFailure: (err) => {
          isConnected = false;
          updateStatus(false, "Koneksi Cloud Tertunda (Fallback Aktif)");
          console.warn("MQTT Connect failed:", err);
          setTimeout(setupMQTT, 8000);
        }
      });
    } catch (e) {
      console.warn("MQTT init error:", e);
      updateStatus(false, "Fallback Mode Aktif");
    }
  }

  function startPresenceHeartbeat(clientId) {
    if (presenceInterval) clearInterval(presenceInterval);
    const sendPing = () => {
      const studentName = (document.getElementById('studentName') && document.getElementById('studentName').value) || userRole;
      RealtimeSync.broadcast('presence', {
        clientId: clientId,
        name: studentName,
        role: userRole,
        time: Date.now()
      });
    };
    sendPing();
    presenceInterval = setInterval(sendPing, 10000); // Tiap 10 detik
  }

  function updateStatus(connected, message) {
    isConnected = connected;
    if (listeners.onStatusChange) {
      listeners.onStatusChange(connected, message);
    }
  }

  // Setup Firebase Realtime Database jika aktif
  function setupFirebase() {
    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      try {
        const ref = firebaseDb.ref(`rooms/${currentRoom}/submissions`);
        ref.on('child_added', (snapshot) => {
          const data = snapshot.val();
          if (data) {
            handleIncomingMessage({ type: 'submission', data: data });
          }
        });
        console.log("🔥 Firebase Listener aktif pada room:", currentRoom);
      } catch (e) {
        console.warn("Firebase listener error:", e);
      }
    }
  }

  return {
    init(config = {}) {
      currentRoom = config.roomId || resolveRoomId();
      userRole = config.role || "player";
      listeners.onSubmission = config.onSubmission || null;
      listeners.onPresence = config.onPresence || null;
      listeners.onStatusChange = config.onStatusChange || null;
      listeners.onHostAction = config.onHostAction || null;

      localStorage.setItem('active_quiz_room', currentRoom);

      setupBroadcastChannel();
      setupMQTT();
      setupFirebase();

      // Trigger presence check interval
      setInterval(() => {
        prunePresence();
        if (listeners.onPresence) {
          listeners.onPresence(onlineParticipants.size, Array.from(onlineParticipants.values()));
        }
      }, 5000);

      return {
        room: currentRoom,
        role: userRole
      };
    },

    broadcast(type, data) {
      const packet = {
        type: type,
        room: currentRoom,
        timestamp: Date.now(),
        data: data
      };

      // 1. BroadcastChannel (Lokal tab)
      if (localChannel) {
        try {
          localChannel.postMessage(packet);
        } catch (e) {}
      }

      // 2. MQTT Cloud (Antar HP & Laptop di internet)
      if (mqttClient && isConnected) {
        try {
          const topic = `antigravity/quiz/${currentRoom}/${type}`;
          const msg = new Paho.MQTT.Message(JSON.stringify(packet));
          msg.destinationName = topic;
          msg.qos = 1;
          mqttClient.send(msg);
        } catch (e) {
          console.warn("MQTT send error", e);
        }
      }

      // 3. Firebase (jika aktif)
      if (type === 'submission' && typeof firebaseDb !== 'undefined' && firebaseDb) {
        try {
          firebaseDb.ref(`rooms/${currentRoom}/submissions`).push(data);
        } catch (e) {
          console.warn("Firebase push error", e);
        }
      }
    },

    submitAnswer(submissionData) {
      // Pastikan ada ID unik
      if (!submissionData.id) {
        submissionData.id = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      }
      submissionData.submittedAt = Date.now();
      submissionData.room = currentRoom;

      saveLocalSubmission(submissionData);
      this.broadcast('submission', submissionData);
      return submissionData;
    },

    broadcastHostAction(actionName, payload = {}) {
      this.broadcast('host_action', { action: actionName, payload: payload });
    },

    getRoomId() {
      return currentRoom;
    },

    setRoomId(newRoom) {
      if (!newRoom) return;
      currentRoom = newRoom.trim().toUpperCase();
      localStorage.setItem('active_quiz_room', currentRoom);
      window.location.search = `?room=${encodeURIComponent(currentRoom)}`;
    },

    getAllSubmissions() {
      return getLocalSubmissions();
    },

    clearAllSubmissions() {
      localStorage.removeItem(`submissions_${currentRoom}`);
      if (typeof firebaseDb !== 'undefined' && firebaseDb) {
        try {
          firebaseDb.ref(`rooms/${currentRoom}/submissions`).remove();
        } catch (e) {}
      }
    },

    deleteSubmission(id) {
      const list = getLocalSubmissions().filter(s => s.id !== id);
      localStorage.setItem(`submissions_${currentRoom}`, JSON.stringify(list));
    }
  };
})();
