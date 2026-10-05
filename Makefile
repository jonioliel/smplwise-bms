# Small entry points. The relay tests need Node 20+ (no keys, no network, no deploy).
.PHONY: test-push-relay
test-push-relay:
	./scripts/test_push_relay.sh
