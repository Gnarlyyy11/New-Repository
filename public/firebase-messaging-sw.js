importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Iyong totoong config
const firebaseConfig = {
  apiKey: "AIzaSyCTUf87sgGcG6X8U_yZ_Nv9xL75jIAuyBs",
  authDomain: "uson-credithub.firebaseapp.com",
  projectId: "uson-credithub",
  storageBucket: "uson-credithub.firebasestorage.app",
  messagingSenderId: "6735654601",
  appId: "1:6735654601:web:fda3104f0bff8a7f80a718"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg' // Pwede mong palitan ng logo mo
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});