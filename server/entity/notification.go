package entity

import "time"

// PushSubscription stores browser push subscription details
type PushSubscription struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Endpoint  string    `gorm:"not null;uniqueIndex" json:"endpoint"`
	P256dh    string    `gorm:"not null" json:"p256dh"`
	Auth      string    `gorm:"not null" json:"auth"`
	UserAgent string    `json:"user_agent,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// NotificationPreference stores notification settings
type NotificationPreference struct {
	ID                          uint  `gorm:"primaryKey" json:"id"`
	SubscriptionID              uint  `gorm:"not null;constraint:OnDelete:CASCADE" json:"subscription_id"`
	BackupProfileID             *uint `gorm:"constraint:OnDelete:CASCADE" json:"backup_profile_id,omitempty"`
	ServerID                    *uint `gorm:"constraint:OnDelete:CASCADE" json:"server_id,omitempty"`
	NotifyOnStart               bool  `gorm:"default:false" json:"notify_on_start"`
	NotifyOnSuccess             bool  `gorm:"default:false" json:"notify_on_success"`
	NotifyOnFailure             bool  `gorm:"default:true" json:"notify_on_failure"`
	NotifyOnConsecutiveFailures bool  `gorm:"default:true" json:"notify_on_consecutive_failures"`
	ConsecutiveFailureThreshold int   `gorm:"default:3" json:"consecutive_failure_threshold"`
	NotifyOnLowStorage          bool  `gorm:"default:true" json:"notify_on_low_storage"`
	LowStorageThreshold         int   `gorm:"default:10" json:"low_storage_threshold"` // percentage

	Subscription  *PushSubscription `gorm:"foreignKey:SubscriptionID" json:"subscription,omitempty"`
	BackupProfile *BackupProfile    `gorm:"foreignKey:BackupProfileID" json:"backup_profile,omitempty"`
	Server        *Server           `gorm:"foreignKey:ServerID" json:"server,omitempty"`
}

// NotificationPreferenceInput is used for creating/updating preferences
type NotificationPreferenceInput struct {
	BackupProfileID             *uint `json:"backup_profile_id,omitempty"`
	ServerID                    *uint `json:"server_id,omitempty"`
	NotifyOnStart               bool  `json:"notify_on_start"`
	NotifyOnSuccess             bool  `json:"notify_on_success"`
	NotifyOnFailure             bool  `json:"notify_on_failure"`
	NotifyOnConsecutiveFailures bool  `json:"notify_on_consecutive_failures"`
	ConsecutiveFailureThreshold int   `json:"consecutive_failure_threshold"`
	NotifyOnLowStorage          bool  `json:"notify_on_low_storage"`
	LowStorageThreshold         int   `json:"low_storage_threshold"`
}

// VAPIDKeys stores the VAPID keys for push notifications
type VAPIDKeys struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	PublicKey  string    `gorm:"not null" json:"public_key"`
	PrivateKey string    `gorm:"not null" json:"-"` // Never expose private key in JSON
	CreatedAt  time.Time `json:"created_at"`
}
