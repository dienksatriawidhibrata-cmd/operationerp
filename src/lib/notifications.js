export function getBrowserNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return window.Notification.permission
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return window.Notification.requestPermission()
}

export function showBrowserNotification(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null
  }

  if (window.Notification.permission !== 'granted') {
    return null
  }

  try {
    return new window.Notification(title, {
      icon: '/favicon.ico',
      ...options,
    })
  } catch (error) {
    console.error('Browser notification failed', error)
    return null
  }
}
