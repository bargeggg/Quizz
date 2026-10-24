// Konfigurasi Firebase Realtime Database
// Dapatkan kredensial gratis di https://console.firebase.google.com/
// 1. Buat project baru
// 2. Aktifkan Realtime Database (pilih Mode Test: read & write: true)
// 3. Masukkan konfigurasi Anda di bawah ini:

const defaultFirebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Cek apakah ada konfigurasi kustom yang disimpan di browser
let activeFirebaseConfig = null;
try {
  const saved = localStorage.getItem('custom_firebase_config');
  if (saved) {
    activeFirebaseConfig = JSON.parse(saved);
  } else if (defaultFirebaseConfig.apiKey && defaultFirebaseConfig.databaseURL) {
    activeFirebaseConfig = defaultFirebaseConfig;
  }
} catch (e) {
  console.warn("Firebase config load error:", e);
}

// Inisialisasi Firebase jika library tersedia & config valid
let firebaseDb = null;
if (typeof firebase !== 'undefined' && activeFirebaseConfig && activeFirebaseConfig.apiKey) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(activeFirebaseConfig);
    }
    firebaseDb = firebase.database();
    console.log("🔥 Firebase Realtime Database aktif terhubung!");
  } catch (err) {
    console.warn("Inisialisasi Firebase gagal, sistem otomatis beralih ke Instant Cloud Sync:", err);
  }
}
