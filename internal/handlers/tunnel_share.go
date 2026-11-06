package handlers

import (
	"fmt"

	"github.com/Sixbravo7388/aura/internal/actions"
	"github.com/Sixbravo7388/aura/internal/clientcfg"
	"github.com/Sixbravo7388/aura/internal/config"
	"github.com/Sixbravo7388/aura/internal/prompt"
)

func handleTunnelShare(ctx *actions.Context) error {
	cfg := ctx.Config.(*config.Config)
	tag := ctx.GetArg("tag")

	if tag == "" {
		return actions.NewError(actions.TunnelShare, "tunnel tag is required", nil)
	}

	tunnel := cfg.GetTunnel(tag)
	if tunnel == nil {
		return actions.NewErrorWithHint(actions.TunnelShare, "tunnel not found",
			"Run 'aura tunnel status' to see available tunnels", nil)
	}

	// Direct-backend Soar has no login: one config serves everyone
	if tunnel.Transport == config.TransportSoar && tunnel.Backend == config.BackendDirect {
		uri, err := clientcfg.GenerateURI(tunnel, nil, cfg, clientcfg.URIOptions{})
		if err != nil {
			return actions.NewError(actions.TunnelShare, "failed to generate URI", err)
		}
		ctx.Output.Print(uri)
		if leg, err2 := clientcfg.GenerateURILegacy(tunnel, nil, cfg, clientcfg.URIOptions{}); err2 == nil && leg != uri {
			ctx.Output.Print(leg)
			ctx.Output.Info("(slipnet:// link for older SlipNet builds)")
		}
		if tunnel.Soar != nil {
			ctx.Output.Info(fmt.Sprintf("Other Soar clients: zone %s — paste this Ed25519 base64 public key (NOT a DNSTT hex key): %s", tunnel.Domain, tunnel.Soar.PublicKey))
		}
		return nil
	}

	backend := cfg.GetBackend(tunnel.Backend)
	if backend == nil {
		return actions.NewError(actions.TunnelShare, "backend not found", nil)
	}
	ensureServerAddress(cfg, ctx.Output, []config.TunnelConfig{*tunnel})

	opts := clientcfg.URIOptions{}

	// For DNSTT transport, ask which client mode
	if tunnel.Transport == config.TransportDNSTT {
		opts.ClientMode = ctx.GetArg("mode")
		if opts.ClientMode == "" {
			var err error
			opts.ClientMode, err = prompt.Select("Client mode", actions.ClientModeOptions)
			if err != nil {
				return err
			}
		}
	}

	// Ask which user's credentials to embed
	if len(cfg.Users) > 0 {
		userOpts := make([]actions.SelectOption, 0, len(cfg.Users)+1)
		userOpts = append(userOpts, actions.SelectOption{Value: "", Label: "No credentials"})
		for _, u := range cfg.Users {
			userOpts = append(userOpts, actions.SelectOption{Value: u.Username, Label: u.Username})
		}
		username, err := prompt.Select("User", userOpts)
		if err != nil {
			return err
		}
		if user := cfg.GetUser(username); user != nil {
			opts.Username = user.Username
			opts.Password = user.Password
		}
	}

	uri, err := clientcfg.GenerateURI(tunnel, backend, cfg, opts)
	if err != nil {
		return actions.NewError(actions.TunnelShare, "failed to generate URI", err)
	}

	ctx.Output.Print(uri)
	if leg, err2 := clientcfg.GenerateURILegacy(tunnel, backend, cfg, opts); err2 == nil && leg != uri {
		ctx.Output.Print(leg)
		ctx.Output.Info("(slipnet:// link for older SlipNet builds)")
	}
	return nil
}
