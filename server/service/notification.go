package service

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"backapp-server/entity"

	"github.com/SherClockHolmes/webpush-go"
)

// NotificationService handles push notifications
type NotificationService struct {
	vapidKeys *entity.VAPIDKeys
}

// NewNotificationService creates a new notification service
func NewNotificationService() *NotificationService {
	return &NotificationService{}
}

// Initialize sets up VAPID keys (creates new ones if not exist)
func (n *NotificationService) Initialize() error {
	var keys entity.VAPIDKeys
	result := DB.First(&keys)

	if result.Error != nil {
		// Generate new VAPID keys
		privateKey, publicKey, err := generateVAPIDKeys()
		if err != nil {
			return fmt.Errorf("failed to generate VAPID keys: %v", err)
		}

		keys = entity.VAPIDKeys{
			PublicKey:  publicKey,
			PrivateKey: privateKey,
			CreatedAt:  time.Now(),
		}

		if err := DB.Create(&keys).Error; err != nil {
			return fmt.Errorf("failed to save VAPID keys: %v", err)
		}

		log.Println("Generated new VAPID keys for push notifications")
	}

	n.vapidKeys = &keys
	return nil
}

// GetPublicKey returns the VAPID public key
func (n *NotificationService) GetPublicKey() string {
	if n.vapidKeys == nil {
		return ""
	}
	return n.vapidKeys.PublicKey
}

// SaveSubscription saves a push subscription
func (n *NotificationService) SaveSubscription(endpoint, p256dh, auth, userAgent string) (*entity.PushSubscription, error) {
	// Check if subscription already exists
	var existing entity.PushSubscription
	if err := DB.Where("endpoint = ?", endpoint).First(&existing).Error; err == nil {
		// Update existing subscription
		existing.P256dh = p256dh
		existing.Auth = auth
		existing.UserAgent = userAgent
		if err := DB.Save(&existing).Error; err != nil {
			return nil, err
		}
		return &existing, nil
	}

	// Create new subscription
	sub := &entity.PushSubscription{
		Endpoint:  endpoint,
		P256dh:    p256dh,
		Auth:      auth,
		UserAgent: userAgent,
		CreatedAt: time.Now(),
	}

	if err := DB.Create(sub).Error; err != nil {
		return nil, err
	}

	// Create default notification preferences for this subscription
	defaultPref := &entity.NotificationPreference{
		SubscriptionID:              sub.ID,
		NotifyOnStart:               false,
		NotifyOnSuccess:             false,
		NotifyOnFailure:             true,
		NotifyOnConsecutiveFailures: true,
		ConsecutiveFailureThreshold: 3,
		NotifyOnLowStorage:          true,
		LowStorageThreshold:         10,
	}

	if err := DB.Create(defaultPref).Error; err != nil {
		log.Printf("Warning: failed to create default notification preferences: %v", err)
	}

	return sub, nil
}

// DeleteSubscription removes a push subscription
func (n *NotificationService) DeleteSubscription(endpoint string) error {
	var sub entity.PushSubscription
	if err := DB.Where("endpoint = ?", endpoint).First(&sub).Error; err != nil {
		return err
	}

	// Delete preferences first (cascade should handle this, but be explicit)
	DB.Where("subscription_id = ?", sub.ID).Delete(&entity.NotificationPreference{})

	return DB.Delete(&sub).Error
}

// GetSubscription returns a subscription by endpoint
func (n *NotificationService) GetSubscription(endpoint string) (*entity.PushSubscription, error) {
	var sub entity.PushSubscription
	if err := DB.Where("endpoint = ?", endpoint).First(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

// ListSubscriptions returns all subscriptions
func (n *NotificationService) ListSubscriptions() ([]entity.PushSubscription, error) {
	var subs []entity.PushSubscription
	if err := DB.Find(&subs).Error; err != nil {
		return nil, err
	}
	return subs, nil
}

// GetPreferences returns notification preferences for a subscription
func (n *NotificationService) GetPreferences(subscriptionID uint) ([]entity.NotificationPreference, error) {
	var prefs []entity.NotificationPreference
	if err := DB.Preload("BackupProfile").Preload("Server").
		Where("subscription_id = ?", subscriptionID).Find(&prefs).Error; err != nil {
		return nil, err
	}
	return prefs, nil
}

// GetPreferencesByEndpoint returns notification preferences for a subscription endpoint
func (n *NotificationService) GetPreferencesByEndpoint(endpoint string) ([]entity.NotificationPreference, error) {
	sub, err := n.GetSubscription(endpoint)
	if err != nil {
		return nil, err
	}
	return n.GetPreferences(sub.ID)
}

// UpdatePreference updates a notification preference
func (n *NotificationService) UpdatePreference(prefID uint, input *entity.NotificationPreferenceInput) (*entity.NotificationPreference, error) {
	var pref entity.NotificationPreference
	if err := DB.First(&pref, prefID).Error; err != nil {
		return nil, err
	}

	pref.BackupProfileID = input.BackupProfileID
	pref.ServerID = input.ServerID
	pref.NotifyOnStart = input.NotifyOnStart
	pref.NotifyOnSuccess = input.NotifyOnSuccess
	pref.NotifyOnFailure = input.NotifyOnFailure
	pref.NotifyOnConsecutiveFailures = input.NotifyOnConsecutiveFailures
	pref.ConsecutiveFailureThreshold = input.ConsecutiveFailureThreshold
	pref.NotifyOnLowStorage = input.NotifyOnLowStorage
	pref.LowStorageThreshold = input.LowStorageThreshold

	if err := DB.Save(&pref).Error; err != nil {
		return nil, err
	}

	return &pref, nil
}

// CreatePreference creates a new notification preference for a subscription
func (n *NotificationService) CreatePreference(subscriptionID uint, input *entity.NotificationPreferenceInput) (*entity.NotificationPreference, error) {
	pref := &entity.NotificationPreference{
		SubscriptionID:              subscriptionID,
		BackupProfileID:             input.BackupProfileID,
		ServerID:                    input.ServerID,
		NotifyOnStart:               input.NotifyOnStart,
		NotifyOnSuccess:             input.NotifyOnSuccess,
		NotifyOnFailure:             input.NotifyOnFailure,
		NotifyOnConsecutiveFailures: input.NotifyOnConsecutiveFailures,
		ConsecutiveFailureThreshold: input.ConsecutiveFailureThreshold,
		NotifyOnLowStorage:          input.NotifyOnLowStorage,
		LowStorageThreshold:         input.LowStorageThreshold,
	}

	if err := DB.Create(pref).Error; err != nil {
		return nil, err
	}

	return pref, nil
}

// DeletePreference deletes a notification preference
func (n *NotificationService) DeletePreference(prefID uint) error {
	return DB.Delete(&entity.NotificationPreference{}, prefID).Error
}

// NotificationPayload represents a push notification
type NotificationPayload struct {
	Title string            `json:"title"`
	Body  string            `json:"body"`
	Icon  string            `json:"icon,omitempty"`
	Badge string            `json:"badge,omitempty"`
	Tag   string            `json:"tag,omitempty"`
	Data  map[string]string `json:"data,omitempty"`
}

// SendNotification sends a push notification to a subscription
func (n *NotificationService) SendNotification(sub *entity.PushSubscription, payload *NotificationPayload) error {
	if n.vapidKeys == nil {
		return fmt.Errorf("VAPID keys not initialized")
	}

	// Create webpush subscription
	s := &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			P256dh: sub.P256dh,
			Auth:   sub.Auth,
		},
	}

	// Marshal payload to JSON
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %v", err)
	}

	// Send notification
	resp, err := webpush.SendNotification(payloadBytes, s, &webpush.Options{
		Subscriber:      "mailto:admin@backapp.local",
		VAPIDPublicKey:  n.vapidKeys.PublicKey,
		VAPIDPrivateKey: n.vapidKeys.PrivateKey,
		TTL:             3600,
	})

	if err != nil {
		return fmt.Errorf("failed to send notification: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusGone {
		// Subscription is no longer valid, remove it
		log.Printf("Subscription expired, removing: %s", sub.Endpoint)
		n.DeleteSubscription(sub.Endpoint)
		return nil
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("push service returned error: %d", resp.StatusCode)
	}

	return nil
}

// SendToAll sends a notification to all subscriptions that match the criteria
func (n *NotificationService) SendToAll(payload *NotificationPayload, filterFunc func(*entity.NotificationPreference) bool) {
	subs, err := n.ListSubscriptions()
	if err != nil {
		log.Printf("Failed to list subscriptions: %v", err)
		return
	}

	for _, sub := range subs {
		prefs, err := n.GetPreferences(sub.ID)
		if err != nil {
			continue
		}

		// Check if any preference matches the filter
		shouldSend := false
		for _, pref := range prefs {
			if filterFunc(&pref) {
				shouldSend = true
				break
			}
		}

		if shouldSend {
			go func(s entity.PushSubscription) {
				if err := n.SendNotification(&s, payload); err != nil {
					log.Printf("Failed to send notification to %s: %v", s.Endpoint, err)
				}
			}(sub)
		}
	}
}

// NotifyBackupStarted sends notification when a backup starts
func (n *NotificationService) NotifyBackupStarted(profileID uint, profileName string) {
	payload := &NotificationPayload{
		Title: "Backup Started",
		Body:  fmt.Sprintf("Backup '%s' has started", profileName),
		Tag:   fmt.Sprintf("backup-started-%d", profileID),
		Data: map[string]string{
			"type":       "backup_started",
			"profile_id": fmt.Sprintf("%d", profileID),
		},
	}

	n.SendToAll(payload, func(pref *entity.NotificationPreference) bool {
		if !pref.NotifyOnStart {
			return false
		}
		// Check if this is a global preference or specific to this profile
		if pref.BackupProfileID == nil {
			return true
		}
		return *pref.BackupProfileID == profileID
	})
}

// NotifyBackupSuccess sends notification when a backup succeeds
func (n *NotificationService) NotifyBackupSuccess(profileID uint, profileName string, duration time.Duration) {
	payload := &NotificationPayload{
		Title: "Backup Completed",
		Body:  fmt.Sprintf("Backup '%s' completed successfully in %s", profileName, duration.Round(time.Second)),
		Tag:   fmt.Sprintf("backup-success-%d", profileID),
		Data: map[string]string{
			"type":       "backup_success",
			"profile_id": fmt.Sprintf("%d", profileID),
		},
	}

	n.SendToAll(payload, func(pref *entity.NotificationPreference) bool {
		if !pref.NotifyOnSuccess {
			return false
		}
		if pref.BackupProfileID == nil {
			return true
		}
		return *pref.BackupProfileID == profileID
	})
}

// NotifyBackupFailed sends notification when a backup fails
func (n *NotificationService) NotifyBackupFailed(profileID uint, profileName string, errorMsg string) {
	payload := &NotificationPayload{
		Title: "Backup Failed",
		Body:  fmt.Sprintf("Backup '%s' failed: %s", profileName, errorMsg),
		Tag:   fmt.Sprintf("backup-failed-%d", profileID),
		Data: map[string]string{
			"type":       "backup_failed",
			"profile_id": fmt.Sprintf("%d", profileID),
		},
	}

	n.SendToAll(payload, func(pref *entity.NotificationPreference) bool {
		if !pref.NotifyOnFailure {
			return false
		}
		if pref.BackupProfileID == nil {
			return true
		}
		return *pref.BackupProfileID == profileID
	})
}

// NotifyConsecutiveFailures sends notification when a backup has failed multiple times
func (n *NotificationService) NotifyConsecutiveFailures(profileID uint, profileName string, failureCount int) {
	payload := &NotificationPayload{
		Title: "Multiple Backup Failures",
		Body:  fmt.Sprintf("Backup '%s' has failed %d times in a row", profileName, failureCount),
		Tag:   fmt.Sprintf("backup-consecutive-failures-%d", profileID),
		Data: map[string]string{
			"type":          "consecutive_failures",
			"profile_id":    fmt.Sprintf("%d", profileID),
			"failure_count": fmt.Sprintf("%d", failureCount),
		},
	}

	n.SendToAll(payload, func(pref *entity.NotificationPreference) bool {
		if !pref.NotifyOnConsecutiveFailures {
			return false
		}
		if failureCount < pref.ConsecutiveFailureThreshold {
			return false
		}
		if pref.BackupProfileID == nil {
			return true
		}
		return *pref.BackupProfileID == profileID
	})
}

// NotifyLowStorage sends notification when storage is running low
func (n *NotificationService) NotifyLowStorage(locationName string, freePercent float64) {
	payload := &NotificationPayload{
		Title: "Low Storage Warning",
		Body:  fmt.Sprintf("Storage location '%s' has only %.1f%% free space remaining", locationName, freePercent),
		Tag:   "low-storage-warning",
		Data: map[string]string{
			"type":         "low_storage",
			"location":     locationName,
			"free_percent": fmt.Sprintf("%.1f", freePercent),
		},
	}

	n.SendToAll(payload, func(pref *entity.NotificationPreference) bool {
		if !pref.NotifyOnLowStorage {
			return false
		}
		return freePercent < float64(pref.LowStorageThreshold)
	})
}

// generateVAPIDKeys generates a new ECDSA P-256 key pair for VAPID
func generateVAPIDKeys() (string, string, error) {
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return "", "", err
	}

	// Encode private key
	privateBytes := privateKey.D.Bytes()
	// Ensure 32 bytes
	privateKeyBytes := make([]byte, 32)
	copy(privateKeyBytes[32-len(privateBytes):], privateBytes)
	privateKeyB64 := base64.RawURLEncoding.EncodeToString(privateKeyBytes)

	// Encode public key (uncompressed point format without 0x04 prefix for Web Push)
	publicKeyBytes := elliptic.Marshal(privateKey.Curve, privateKey.PublicKey.X, privateKey.PublicKey.Y)
	publicKeyB64 := base64.RawURLEncoding.EncodeToString(publicKeyBytes)

	return privateKeyB64, publicKeyB64, nil
}

// GetConsecutiveFailureCount returns the number of consecutive failures for a profile
func GetConsecutiveFailureCount(profileID uint) int {
	var runs []entity.BackupRun
	if err := DB.Where("backup_profile_id = ?", profileID).
		Order("start_time DESC").
		Limit(10).
		Find(&runs).Error; err != nil {
		return 0
	}

	count := 0
	for _, run := range runs {
		if run.Status == "failed" {
			count++
		} else {
			break
		}
	}

	return count
}

// Global notification service instance
var NotificationSvc *NotificationService

// InitNotificationService initializes the global notification service
func InitNotificationService() error {
	NotificationSvc = NewNotificationService()
	return NotificationSvc.Initialize()
}
