import { soundService } from './soundService';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  conversationId?: string;
  data?: Record<string, any>;
  onClick?: () => void;
}

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private readonly STORAGE_KEY_NOTIFS = 'mmd_notifications_enabled';
  private readonly STORAGE_KEY_SOUNDS = 'mmd_sounds_enabled';

  constructor() {
    this.initServiceWorker();
  }

  /**
   * Register service worker if supported
   */
  public async initServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        this.swRegistration = reg;
        console.log('Service Worker enregistré pour les notifications push:', reg.scope);

        // Listen for messages from service worker (e.g. notification click)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'NAVIGATE_CONVERSATION' && event.data.conversationId) {
            this.dispatchConversationNavigation(event.data.conversationId);
          }
        });
      } catch (err) {
        console.warn('Impossible d\'enregistrer le Service Worker:', err);
      }
    }
  }

  /**
   * Check if browser supports notifications
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current browser notification permission
   */
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Check if user enabled notifications in app settings
   */
  public isNotificationsEnabled(): boolean {
    const saved = localStorage.getItem(this.STORAGE_KEY_NOTIFS);
    if (saved === null) return true; // Enabled by default
    return saved === 'true';
  }

  /**
   * Set user notifications preference
   */
  public setNotificationsEnabled(enabled: boolean) {
    localStorage.setItem(this.STORAGE_KEY_NOTIFS, enabled ? 'true' : 'false');
  }

  /**
   * Check if sound notifications are enabled
   */
  public isSoundEnabled(): boolean {
    const saved = localStorage.getItem(this.STORAGE_KEY_SOUNDS);
    if (saved === null) return true; // Enabled by default
    return saved === 'true';
  }

  /**
   * Set sound notifications preference
   */
  public setSoundEnabled(enabled: boolean) {
    localStorage.setItem(this.STORAGE_KEY_SOUNDS, enabled ? 'true' : 'false');
  }

  /**
   * Request notification permission from browser
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.setNotificationsEnabled(true);
      }
      return permission;
    } catch (err) {
      console.error('Erreur demande permission notifications:', err);
      return 'denied';
    }
  }

  /**
   * Show a system push notification
   */
  public async showNotification(payload: NotificationPayload) {
    // 1. Play sound chime if sound enabled
    if (this.isSoundEnabled()) {
      soundService.playMessageNotification();
    }

    // 2. If notifications disabled by user or not supported, exit
    if (!this.isNotificationsEnabled() || !this.isSupported()) {
      return;
    }

    // 3. If permission not granted, do not try
    if (Notification.permission !== 'granted') {
      return;
    }

    const {
      title,
      body,
      icon = '/komechat_logo.jpg',
      badge = '/komechat_logo.jpg',
      tag = payload.conversationId ? `conv_${payload.conversationId}` : 'komechat_notif',
      conversationId,
      data = {},
      onClick,
    } = payload;

    const notificationData = {
      ...data,
      conversationId,
      url: window.location.origin,
    };

    // If Service Worker is ready, prefer showNotification on registration
    if (this.swRegistration && 'showNotification' in this.swRegistration) {
      try {
        await this.swRegistration.showNotification(title, {
          body,
          icon,
          badge,
          tag,
          data: notificationData,
          vibrate: [200, 100, 200],
        } as NotificationOptions);
        return;
      } catch (e) {
        console.warn('Erreur showNotification via Service Worker, fallback standard:', e);
      }
    }

    // Standard Desktop Notification API fallback
    try {
      const notif = new Notification(title, {
        body,
        icon,
        badge,
        tag,
        data: notificationData,
      });

      notif.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notif.close();

        if (onClick) {
          onClick();
        } else if (conversationId) {
          this.dispatchConversationNavigation(conversationId);
        }
      };
    } catch (err) {
      console.warn('Erreur affichage Notification HTML5:', err);
    }
  }

  /**
   * Format message content into friendly snippet for notification body
   */
  public formatMessageBody(message: {
    type?: string;
    content?: string;
    sender?: { firstName: string; lastName: string };
  }): string {
    if (!message) return 'Nouveau message reçu';

    switch (message.type) {
      case 'IMAGE':
        return '📷 [Photo] ' + (message.content ? message.content : '');
      case 'VIDEO':
        return '🎥 [Vidéo] ' + (message.content ? message.content : '');
      case 'AUDIO':
        return '🎤 [Message vocal]';
      case 'FILE':
        return '📎 [Fichier joint] ' + (message.content ? message.content : '');
      default:
        return message.content || 'Nouveau message';
    }
  }

  /**
   * Dispatch custom event to tell React to switch to this conversation
   */
  public dispatchConversationNavigation(conversationId: string) {
    window.dispatchEvent(
      new CustomEvent('mmd:select-conversation', {
        detail: { conversationId },
      })
    );
  }

  /**
   * Send a test notification
   */
  public async sendTestNotification() {
    const permission = await this.requestPermission();
    if (permission === 'granted') {
      await this.showNotification({
        title: 'KOMECHAT - Test de Notification',
        body: 'Les notifications Push sont correctement configurées et opérationnelles ! 🎉',
        icon: '/komechat_logo.jpg',
      });
      return true;
    }
    return false;
  }
}

export const notificationService = new NotificationService();
