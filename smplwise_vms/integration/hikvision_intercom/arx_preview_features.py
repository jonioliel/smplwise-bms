"""Owner-authorized builds; actual execution still needs current native sources.

The 2026-10-21 ECC directive supersedes the historical blanket OFF build. These
switches publish code availability, never authority, host installation or a
physical outcome. A disabled switch remains an immediate runtime refusal.
"""

ARX_PERSON_READBACK_V1 = True
ARX_SCHEDULE_NORMALIZE_V1 = True

PERSON_READBACK = "users/access_state"
PERSON_READBACK_V2 = "users/access_state_v2"
SCHEDULE_NORMALIZE = "schedules/normalize_user"
CANDIDATE_READS = frozenset({PERSON_READBACK, PERSON_READBACK_V2, SCHEDULE_NORMALIZE})

# Legacy planning stays a draft projection. The actual native execution host
# reports its separate registered/current-source state through features/status.
PLAN_FLAGS = {
    "door_windows": True,
    "emergency_buttons": True,
    "door_automations": True,
    "people_csv": True,
    "live_media": True,
    "live_validation": True,
}


def enabled(command: str) -> bool:
    if command in {PERSON_READBACK, PERSON_READBACK_V2}:
        return ARX_PERSON_READBACK_V1 is True
    if command == SCHEDULE_NORMALIZE:
        return ARX_SCHEDULE_NORMALIZE_V1 is True
    return False


def published(commands: list[str]) -> list[str]:
    """Do not advertise a disabled candidate as a usable legacy command."""
    return [command for command in commands if command not in CANDIDATE_READS or enabled(command)]


def capabilities() -> list[str]:
    return (
        ["person_access_state_v1", "person_access_state_v2"]
        if ARX_PERSON_READBACK_V1 is True else []
    ) + (
        ["user_schedule_normalization_v1"] if ARX_SCHEDULE_NORMALIZE_V1 is True else []
    )
