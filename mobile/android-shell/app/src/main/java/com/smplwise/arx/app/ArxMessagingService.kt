package com.smplwise.arx.app

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class ArxMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) { PushCoordinator.get(this).updatedToken(token) }
    override fun onMessageReceived(message: RemoteMessage) { PushDelivery.receive(this, message.data) }
}
