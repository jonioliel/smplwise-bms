"""Editable station talk duration, shared by options and native descriptors."""

SETTING = "station_media_max_talk_seconds"
DEFAULT_SECONDS = 300
MAX_SECONDS = 86_400


def talk_seconds(value):
    if type(value) is not int or not 1 <= value <= MAX_SECONDS:
        raise ValueError("Talk duration must be an integer from 1 to 86400 seconds")
    return value
