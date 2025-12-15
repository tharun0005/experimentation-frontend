/**
 * Toast Notification System - Global Utility
 * Provides success, error, warning, and info notifications across all pages
 */

class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.maxNotifications = 5;
        this.init();
    }

    init() {
        if (!document.querySelector('.notification-container')) {
            this.container = document.createElement('div');
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.querySelector('.notification-container');
        }

        console.log('✅ Notification system initialized');
    }

    show(message, type = 'info', title = null, duration = 5000) {
        if (this.notifications.length >= this.maxNotifications) {
            this.dismiss(this.notifications[0]);
        }

        const notification = this.createNotification(message, type, title, duration);
        this.container.appendChild(notification);
        this.notifications.push(notification);

        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }

        return notification;
    }

    createNotification(message, type, title, duration) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.position = 'relative';

        const icon = this.getIcon(type);

        if (!title) {
            title = this.getDefaultTitle(type);
        }

        notification.innerHTML = `
            <div class="notification-icon">
                ${icon}
            </div>
            <div class="notification-content">
                <div class="notification-title">${this.escapeHtml(title)}</div>
                <div class="notification-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="notification-close" aria-label="Close notification">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            ${duration > 0 ? '<div class="notification-progress"></div>' : ''}
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.dismiss(notification));

        return notification;
    }

    getIcon(type) {
        const icons = {
            success: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>`,
            error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>`,
            warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>`,
            info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>`
        };
        return icons[type] || icons.info;
    }

    getDefaultTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || 'Notification';
    }

    dismiss(notification) {
        if (!notification || !notification.parentElement) return;

        notification.classList.add('slide-out');

        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }

            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }

    dismissAll() {
        const notificationsToClose = [...this.notifications];
        notificationsToClose.forEach(notification => this.dismiss(notification));
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    getCount() {
        return this.notifications.length;
    }

    hasNotifications() {
        return this.notifications.length > 0;
    }
}

const notificationManager = new NotificationManager();

function showNotification(message, type = 'info', title = null, duration = 5000) {
    return notificationManager.show(message, type, title, duration);
}

function showSuccess(message, title = 'Success', duration = 5000) {
    return notificationManager.show(message, 'success', title, duration);
}

function showError(message, title = 'Error', duration = 5000) {
    return notificationManager.show(message, 'error', title, duration);
}

function showWarning(message, title = 'Warning', duration = 5000) {
    return notificationManager.show(message, 'warning', title, duration);
}

function showInfo(message, title = 'Info', duration = 5000) {
    return notificationManager.show(message, 'info', title, duration);
}

function dismissAllNotifications() {
    notificationManager.dismissAll();
}

function getNotificationCount() {
    return notificationManager.getCount();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NotificationManager,
        notificationManager,
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        dismissAllNotifications,
        getNotificationCount
    };
}

window.notificationManager = notificationManager;
window.showNotification = showNotification;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.dismissAllNotifications = dismissAllNotifications;
window.getNotificationCount = getNotificationCount;
