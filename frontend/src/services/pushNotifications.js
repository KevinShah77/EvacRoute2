// Web Push Notifications Registration Helper
import { api } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermissionAndSubscribe() {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support desktop or mobile push notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied by user.');
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker is not supported in this browser.');
  }

  const registration = await navigator.serviceWorker.ready;
  
  // Fetch VAPID public key from backend
  const { publicKey } = await api.getVapidPublicKey();
  if (!publicKey) {
    throw new Error('VAPID public key unavailable from server.');
  }

  const convertedVapidKey = urlBase64ToUint8Array(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });
  }

  const subJson = subscription.toJSON();
  await api.subscribePush({
    endpoint: subJson.endpoint,
    keys: {
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    },
    device_name: `${navigator.platform || 'Device'} (${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'})`,
  });

  return { success: true, subscription };
}
