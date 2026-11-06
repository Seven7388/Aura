package clientcfg

import (
	"encoding/base64"
	"fmt"
	"strings"
)

// Primary scheme used when generating new URIs (Aura brand).
const uriScheme = "auranet://"

// legacyScheme is accepted on import so existing SlipNet profiles and
// older share links still decode correctly.
const legacyScheme = "slipnet://"

// Encode takes fields and produces an auranet:// URI.
// Uses standard base64 (not URL-safe) with no padding wrapping, matching the app.
func Encode(fields []string) string {
	payload := strings.Join(fields, "|")
	encoded := base64.StdEncoding.EncodeToString([]byte(payload))
	return uriScheme + encoded
}

// EncodeWithScheme is like Encode but lets the caller pick the scheme
// (e.g. legacy "slipnet://" for maximum compatibility with older SlipNet builds).
func EncodeWithScheme(fields []string, scheme string) string {
	if scheme == "" {
		scheme = uriScheme
	}
	if !strings.HasSuffix(scheme, "://") {
		scheme += "://"
	}
	payload := strings.Join(fields, "|")
	encoded := base64.StdEncoding.EncodeToString([]byte(payload))
	return scheme + encoded
}

// Decode parses an auranet:// or slipnet:// URI back into fields.
// Also accepts a bare base64 payload (no scheme) for copy-paste robustness.
func Decode(uri string) ([TotalFields]string, error) {
	var fields [TotalFields]string

	uri = strings.TrimSpace(uri)
	if uri == "" {
		return fields, fmt.Errorf("empty URI")
	}

	encoded := uri
	switch {
	case strings.HasPrefix(uri, uriScheme):
		encoded = strings.TrimPrefix(uri, uriScheme)
	case strings.HasPrefix(uri, legacyScheme):
		encoded = strings.TrimPrefix(uri, legacyScheme)
	case strings.Contains(uri, "://"):
		// Unknown scheme — still try to strip and decode the payload
		if idx := strings.Index(uri, "://"); idx >= 0 {
			encoded = uri[idx+3:]
		}
	}

	// Reject the old query-string style (slipnet://dnstt?domain=...) early with
	// a clear error — those come from a different installer and are not the
	// pipe/base64 format AuraNet / modern SlipNet expect.
	if (strings.Contains(encoded, "?") || strings.Contains(encoded, "=")) && !isLikelyBase64(encoded) {
		return fields, fmt.Errorf("URI looks like query-string format (not supported); use an auranet:// or slipnet:// base64 share link from 'aura tunnel share' / 'aura users configs'")
	}

	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		// Try URL-safe encoding as fallback
		data, err = base64.URLEncoding.DecodeString(encoded)
		if err != nil {
			// Try with padding restored
			padded := encoded
			if m := len(padded) % 4; m != 0 {
				padded += strings.Repeat("=", 4-m)
			}
			data, err = base64.StdEncoding.DecodeString(padded)
			if err != nil {
				return fields, fmt.Errorf("failed to decode URI payload: %w", err)
			}
		}
	}

	parts := strings.Split(string(data), "|")
	if len(parts) < 4 {
		return fields, fmt.Errorf("URI payload too short (%d fields); expected pipe-delimited config", len(parts))
	}
	for i := 0; i < len(parts) && i < TotalFields; i++ {
		fields[i] = parts[i]
	}

	return fields, nil
}

func isLikelyBase64(s string) bool {
	if len(s) < 16 {
		return false
	}
	for _, c := range s {
		if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=' || c == '-' || c == '_' {
			continue
		}
		return false
	}
	return true
}
