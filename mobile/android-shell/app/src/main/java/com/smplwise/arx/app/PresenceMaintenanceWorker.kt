package com.smplwise.arx.app

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class PresenceMaintenanceWorker(c: Context, p: WorkerParameters) : Worker(c, p) {
    override fun doWork(): Result {
        SensorCoordinator.get(applicationContext).refreshConfigs()
        return Result.success()
    }
}
