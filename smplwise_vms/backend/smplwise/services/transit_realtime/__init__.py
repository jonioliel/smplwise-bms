"""Transit real-time estimates (BUSRT-295). Public interface for the scheduled bus-times feature:

    from smplwise.services.transit_realtime import RealtimeEngine, ScheduledArrival, Config
    engine = RealtimeEngine(source, config=Config())            # one per process
    result = engine.annotate(stop_code, scheduled_rows, now)     # -> Result(arrivals=(Arrival, ...), realtime_state, ...)

See docs/design/BUS_REALTIME_NOTE.md for the contract."""
from .engine import RealtimeEngine, RealtimeSource, ScheduleProvider
from .model import Arrival, Config, Observation, Result, ScheduledArrival

__all__ = ["RealtimeEngine", "RealtimeSource", "ScheduleProvider", "Arrival", "Config", "Observation", "Result", "ScheduledArrival"]
