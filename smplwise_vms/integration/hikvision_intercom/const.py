"""Shared integration constants."""

DOMAIN = "hikvision_intercom"
MAX_AUDIO_SESSIONS = 3
VERSION = "2.0.0-rc.38"
PLATFORMS = ("binary_sensor", "sensor", "camera", "lock", "event")
DEFAULT_IDLE_INTERVAL = 2.0
DEFAULT_ACTIVE_INTERVAL = 0.75
DEFAULT_PULSE_SECONDS = 5.0
CALL_STATES = ("idle", "ringing", "in_call", "ending", "unknown", "unavailable")
