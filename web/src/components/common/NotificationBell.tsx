import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import {
  Badge,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { notificationApi } from '../../api';

interface NotificationBellProps {
  // Optional: if provided, only applies to this specific profile
  profileId?: number;
  // Optional: if provided, only applies to this specific server
  serverId?: number;
  // Size of the icon button
  size?: 'small' | 'medium' | 'large';
  // Show label next to icon
  showLabel?: boolean;
  // Callback when subscription state changes
  onStateChange?: (isSubscribed: boolean) => void;
}

// Store service worker registration globally
let swRegistration: ServiceWorkerRegistration | null = null;

export function NotificationBell({
  profileId,
  serverId,
  size = 'medium',
  showLabel = false,
  onStateChange,
}: NotificationBellProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    checkSubscriptionStatus();
  }, [profileId, serverId]);

  const checkSubscriptionStatus = async () => {
    try {
      // Check if push notifications are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsSupported(false);
        setLoading(false);
        return;
      }

      setPermission(Notification.permission);

      // Get or register service worker
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      }

      // Check if already subscribed
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        // Check if we have preferences for this profile/server
        try {
          const prefs = await notificationApi.getPreferences(subscription.endpoint);
          const hasMatchingPref = prefs.some(pref => {
            if (profileId) return pref.backup_profile_id === profileId;
            if (serverId) return pref.server_id === serverId;
            return pref.backup_profile_id === undefined && pref.server_id === undefined;
          });
          setIsSubscribed(hasMatchingPref);
        } catch {
          setIsSubscribed(false);
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsSupported(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!isSupported) return;

    setLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (error) {
      console.error('Error toggling notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async () => {
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission !== 'granted') {
        return;
      }

      // Get VAPID public key
      const { public_key } = await notificationApi.getVapidKey();

      // Get or register service worker
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      }

      // Subscribe to push
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });

      // Send subscription to server
      const subJson = subscription.toJSON();
      await notificationApi.subscribe({
        endpoint: subJson.endpoint!,
        keys: {
          p256dh: subJson.keys!.p256dh,
          auth: subJson.keys!.auth,
        },
        user_agent: navigator.userAgent,
      });

      // Create a preference for this specific profile/server if provided
      if (profileId || serverId) {
        await notificationApi.createPreference(subJson.endpoint!, {
          backup_profile_id: profileId,
          server_id: serverId,
          notify_on_start: false,
          notify_on_success: false,
          notify_on_failure: true,
          notify_on_consecutive_failures: true,
          consecutive_failure_threshold: 3,
          notify_on_low_storage: !profileId && !serverId,
          low_storage_threshold: 10,
        });
      }

      setIsSubscribed(true);
      onStateChange?.(true);
    } catch (error) {
      console.error('Error subscribing:', error);
    }
  };

  const unsubscribe = async () => {
    try {
      if (!swRegistration) return;

      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        // If this is for a specific profile/server, just delete that preference
        if (profileId || serverId) {
          const prefs = await notificationApi.getPreferences(subscription.endpoint);
          const matchingPref = prefs.find(pref => {
            if (profileId) return pref.backup_profile_id === profileId;
            if (serverId) return pref.server_id === serverId;
            return false;
          });
          if (matchingPref) {
            await notificationApi.deletePreference(matchingPref.id);
          }
        } else {
          // Unsubscribe completely
          await subscription.unsubscribe();
          await notificationApi.unsubscribe(subscription.endpoint);
        }
      }

      setIsSubscribed(false);
      onStateChange?.(false);
    } catch (error) {
      console.error('Error unsubscribing:', error);
    }
  };

  const getTooltip = () => {
    if (!isSupported) return 'Push notifications not supported';
    if (permission === 'denied') return 'Notifications blocked by browser';
    if (loading) return 'Loading...';
    return isSubscribed ? 'Disable notifications' : 'Enable notifications';
  };

  const getIcon = () => {
    if (!isSupported || permission === 'denied') {
      return <NotificationsOffIcon />;
    }
    if (isSubscribed) {
      return <NotificationsActiveIcon />;
    }
    return <NotificationsIcon />;
  };

  return (
    <Tooltip title={getTooltip()}>
      <span>
        <IconButton
          onClick={handleToggle}
          disabled={!isSupported || loading || permission === 'denied'}
          size={size}
          color={isSubscribed ? 'primary' : 'default'}
          data-testid="notification-bell"
        >
          {loading ? (
            <CircularProgress size={size === 'small' ? 16 : 24} />
          ) : (
            <Badge
              color="error"
              variant="dot"
              invisible={!isSubscribed}
            >
              {getIcon()}
            </Badge>
          )}
        </IconButton>
        {showLabel && (
          <span style={{ marginLeft: 8 }}>
            {isSubscribed ? 'Notifications On' : 'Notifications Off'}
          </span>
        )}
      </span>
    </Tooltip>
  );
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
