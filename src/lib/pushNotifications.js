import { supabase } from './supabase'

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Returns 'granted' | 'denied' | 'unsupported' | 'error'
export async function requestPushPermission() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) return 'unsupported'

  try {
    const reg        = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return permission

    const existing = await reg.pushManager.getSubscription()
    const sub      = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'error'

    const subJson = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id:      user.id,
      endpoint:     subJson.endpoint,
      subscription: subJson,
    }, { onConflict: 'user_id,endpoint' })

    return 'granted'
  } catch (err) {
    console.error('[Sown] Push subscription failed:', err)
    return 'error'
  }
}
