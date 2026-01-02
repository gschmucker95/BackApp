package controller

import (
	"net/http"
	"strconv"

	"backapp-server/entity"
	"backapp-server/service"

	"github.com/gin-gonic/gin"
)

// handleGetVAPIDPublicKey returns the VAPID public key for push subscriptions
func handleGetVAPIDPublicKey(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"public_key": service.NotificationSvc.GetPublicKey(),
	})
}

// PushSubscriptionInput represents the subscription data from the browser
type PushSubscriptionInput struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys" binding:"required"`
	UserAgent string `json:"user_agent"`
}

// handleSubscribePush creates a new push subscription
func handleSubscribePush(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	var input PushSubscriptionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sub, err := service.NotificationSvc.SaveSubscription(
		input.Endpoint,
		input.Keys.P256dh,
		input.Keys.Auth,
		input.UserAgent,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sub)
}

// handleUnsubscribePush removes a push subscription
func handleUnsubscribePush(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	var input struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.NotificationSvc.DeleteSubscription(input.Endpoint); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "unsubscribed"})
}

// handleGetSubscription returns a subscription by endpoint
func handleGetSubscription(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	endpoint := c.Query("endpoint")
	if endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint required"})
		return
	}

	sub, err := service.NotificationSvc.GetSubscription(endpoint)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	c.JSON(http.StatusOK, sub)
}

// handleGetNotificationPreferences returns preferences for a subscription
func handleGetNotificationPreferences(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	endpoint := c.Query("endpoint")
	if endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint required"})
		return
	}

	prefs, err := service.NotificationSvc.GetPreferencesByEndpoint(endpoint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prefs)
}

// handleCreateNotificationPreference creates a new preference
func handleCreateNotificationPreference(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	endpoint := c.Query("endpoint")
	if endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint required"})
		return
	}

	sub, err := service.NotificationSvc.GetSubscription(endpoint)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	var input entity.NotificationPreferenceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pref, err := service.NotificationSvc.CreatePreference(sub.ID, &input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pref)
}

// handleUpdateNotificationPreference updates a preference
func handleUpdateNotificationPreference(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var input entity.NotificationPreferenceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pref, err := service.NotificationSvc.UpdatePreference(uint(id), &input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pref)
}

// handleDeleteNotificationPreference deletes a preference
func handleDeleteNotificationPreference(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := service.NotificationSvc.DeletePreference(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// handleGetStorageUsage returns storage usage information
func handleGetStorageUsage(c *gin.Context) {
	usage, err := service.GetStorageUsage()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, usage)
}

// handleGetStorageLocationUsage returns storage usage for a specific location
func handleGetStorageLocationUsage(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	usage, err := service.GetStorageLocationUsage(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, usage)
}

// handleSendTestNotification sends a test notification
func handleSendTestNotification(c *gin.Context) {
	if service.NotificationSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service not initialized"})
		return
	}

	endpoint := c.Query("endpoint")
	if endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint required"})
		return
	}

	sub, err := service.NotificationSvc.GetSubscription(endpoint)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	payload := &service.NotificationPayload{
		Title: "Test Notification",
		Body:  "This is a test notification from BackApp",
		Tag:   "test",
		Data: map[string]string{
			"type": "test",
		},
	}

	if err := service.NotificationSvc.SendNotification(sub, payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "notification sent"})
}
