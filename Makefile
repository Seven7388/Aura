VERSION ?= 1.6.8
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS  = -X github.com/Sixbravo7388/aura/internal/version.Version=$(VERSION) \
           -X github.com/Sixbravo7388/aura/internal/version.Commit=$(COMMIT) \
           $(if $(RELEASE_TAG),-X github.com/Sixbravo7388/aura/internal/version.ReleaseTag=$(RELEASE_TAG))

# RELEASE_TAG is set by the build-dev target below. It must be evaluated
# at recipe-expansion time (via $(if ...)), not parse time — the previous
# `ifdef RELEASE_TAG` form ran before target-specific variables applied,
# so dev builds silently dropped the ReleaseTag ldflag and the resulting
# binary reported itself as stable.

.PHONY: build clean test install release build-dev

build:
	go build -trimpath -ldflags "$(LDFLAGS)" -o aura .

build-linux:
	GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "$(LDFLAGS)" -o aura-linux-amd64 .
	GOOS=linux GOARCH=arm64 go build -trimpath -ldflags "$(LDFLAGS)" -o aura-linux-arm64 .

build-dev: RELEASE_TAG = dev-$(COMMIT)
build-dev: build-linux
	@echo "Dev binaries built (release tag: dev-$(COMMIT))"
	@ls -la aura-linux-*

clean:
	rm -f aura aura-linux-*

test:
	go test ./...

install: build
	sudo cp aura /usr/local/bin/
	@echo "Installed to /usr/local/bin/aura"

release: clean build-linux
	@echo "Built release binaries"
	@ls -la aura-linux-*
