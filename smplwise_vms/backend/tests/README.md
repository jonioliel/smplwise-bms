# Backend tests

## Wall-clock performance bounds

A handful of tests assert a property that is really about behaviour - "labels do not slow the detector down",
"the request does not wait for its worker", "a read does not block on a writer holding the lock" - but can only
observe it by timing something. Their default assertion uses a generous bound (or a ratio measured against another
call made in the same process, at the same moment) so that a busy workstation does not turn a behavioural check
into a flaky one.

Two knobs, defined in `conftest.py` (`sw_time_factor`, `sw_perf_enabled`) and imported by each affected test:

- `SW_TEST_TIME_FACTOR` (float, default `1`): multiplies the default (generous) bound further, for a machine or CI
  runner that is reliably slower or busier than usual. Values below 1 are ignored.
- `SW_PERF=1`: switches each of these tests to its original, tight bound (documented inline at each call site).
  Tight bounds only hold on a quiet machine, so they are opt-in - run them alone, without other CPU-heavy agents or
  builds running, to actually catch a performance regression on purpose.

Tests currently using this pattern:

- `test_plan_detect_walls.py::test_room_labels_add_no_walls_and_do_not_slow_the_detector`
- `test_plan_detect_api.py::test_detect_timeout_answers_504_and_discards_the_result`
- `test_plan_detect_raster.py::test_thinning_a_plan_with_a_solid_block_is_fast_and_max_iter_is_not_silent`
- `test_plan_dxf_map.py::test_large_drawing_maps_within_bound`
- `test_plan_dxf_map.py::test_routes_answer_504_when_the_worker_outruns_the_guard`
- `test_plan_dxf_map.py::test_kilometre_extents_are_refused_and_a_long_line_stays_cheap`
- `test_read_mode.py::test_reads_do_not_wait_for_a_writer`

`test_intercom.py::test_busy_is_answered_at_once` predates this pattern but already follows its spirit: the bound
is `COMMAND_TIMEOUT_S / 2` (an order of magnitude below the real timeout it guards against), built from a client
constructed before the clock starts, so it does not need `SW_TEST_TIME_FACTOR` to stay robust under load.
