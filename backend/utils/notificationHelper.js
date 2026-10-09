const Notification = require('../models/Notification');

/**
 * Safely create a single notification without throwing errors
 */
const createNotification = async ({
  recipientId,
  type,
  title,
  message,
  relatedEntityType,
  relatedEntityId
}) => {
  try {
    if (!recipientId || !type || !title || !message) {
      return null;
    }
    const notification = await Notification.create({
      recipientId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      isRead: false
    });
    return notification;
  } catch (error) {
    console.error('[Notification Helper Error]: Failed to create notification:', error.message);
    return null;
  }
};

/**
 * Safely create notifications for multiple recipients without throwing errors
 */
const notifyManyUsers = async (recipientIds, notificationData) => {
  try {
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) return;
    
    // Deduplicate recipient IDs to avoid duplicate notifications
    const uniqueRecipientIds = Array.from(new Set(recipientIds.map(id => id.toString())));
    
    const notifications = uniqueRecipientIds.map(id => ({
      recipientId: id,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      relatedEntityType: notificationData.relatedEntityType,
      relatedEntityId: notificationData.relatedEntityId,
      isRead: false
    }));

    await Notification.insertMany(notifications);
  } catch (error) {
    console.error('[Notification Helper Error]: Failed to notify multiple users:', error.message);
  }
};

module.exports = {
  createNotification,
  notifyManyUsers
};
