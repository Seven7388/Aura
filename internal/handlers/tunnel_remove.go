package handlers

import (
	"fmt"
	"os"

	"github.com/Sixbravo7388/aura/internal/actions"
	"github.com/Sixbravo7388/aura/internal/config"
	"github.com/Sixbravo7388/aura/internal/prompt"
	"github.com/Sixbravo7388/aura/internal/router"
	"github.com/Sixbravo7388/aura/internal/service"
)

func handleTunnelRemove(ctx *actions.Context) error {
	cfg := ctx.Config.(*config.Config)
	tag := ctx.GetArg("tag")

	// Interactive: no tag given — let the user pick a tunnel or "all"
	if tag == "" {
		if len(cfg.Tunnels) == 0 {
			ctx.Output.Info("No tunnels configured.")
			return nil
		}
		opts := make([]actions.SelectOption, 0, len(cfg.Tunnels)+1)
		for _, t := range cfg.Tunnels {
			label := fmt.Sprintf("%s (%s / %s)", t.Tag, t.Transport, t.Backend)
			if t.Domain != "" {
				label = fmt.Sprintf("%s — %s", label, t.Domain)
			}
			opts = append(opts, actions.SelectOption{Value: t.Tag, Label: label})
		}
		opts = append(opts, actions.SelectOption{Value: "--all", Label: "Remove ALL tunnels"})
		var err error
		tag, err = prompt.Select("Remove which tunnel?", opts)
		if err != nil {
			return err
		}
	}

	if tag == "--all" || tag == "all" {
		return handleTunnelRemoveAll(ctx, cfg)
	}

	tunnel := cfg.GetTunnel(tag)
	if tunnel == nil {
		return actions.NewError(actions.TunnelRemove, fmt.Sprintf("tunnel %q not found", tag), nil)
	}

	ok, err := prompt.Confirm(fmt.Sprintf("Remove tunnel %q? This will stop the service and delete all keys.", tag))
	if err != nil {
		return err
	}
	if !ok {
		ctx.Output.Info("Cancelled")
		return nil
	}

	removeSingleTunnel(ctx, cfg, tag)

	if err := cfg.Save(); err != nil {
		return actions.NewError(actions.TunnelRemove, "failed to save config", err)
	}

	ctx.Output.Success(fmt.Sprintf("Tunnel %q removed", tag))
	return nil
}

func handleTunnelRemoveAll(ctx *actions.Context, cfg *config.Config) error {
	if len(cfg.Tunnels) == 0 {
		ctx.Output.Info("No tunnels to remove")
		return nil
	}

	ok, err := prompt.Confirm(fmt.Sprintf("Remove ALL %d tunnel(s)? This will stop all services and delete all keys.", len(cfg.Tunnels)))
	if err != nil {
		return err
	}
	if !ok {
		ctx.Output.Info("Cancelled")
		return nil
	}

	var tags []string
	for _, t := range cfg.Tunnels {
		tags = append(tags, t.Tag)
	}

	for _, tag := range tags {
		removeSingleTunnel(ctx, cfg, tag)
		ctx.Output.Success(fmt.Sprintf("Removed %q", tag))
	}

	if err := cfg.Save(); err != nil {
		return actions.NewError(actions.TunnelRemove, "failed to save config", err)
	}

	ctx.Output.Success(fmt.Sprintf("All %d tunnel(s) removed", len(tags)))
	return nil
}

func removeSingleTunnel(ctx *actions.Context, cfg *config.Config, tag string) {
	svcName := service.TunnelServiceName(tag)
	_ = service.Stop(svcName)
	_ = service.Remove(svcName)

	_ = router.RemoveTunnel(cfg, tag)

	tunnelDir := config.TunnelDir(tag)
	if err := os.RemoveAll(tunnelDir); err != nil {
		ctx.Output.Warning(fmt.Sprintf("Failed to remove tunnel dir: %v", err))
	}

	cfg.RemoveTunnel(tag)
	if cfg.Route.Active == tag {
		cfg.Route.Active = ""
		if len(cfg.Tunnels) > 0 {
			cfg.Route.Active = cfg.Tunnels[0].Tag
		}
	}
	if cfg.Route.Default == tag {
		cfg.Route.Default = cfg.Route.Active
	}

	if cfg.Route.Mode == "multi" {
		dnsTunnelCount := 0
		for _, t := range cfg.Tunnels {
			if t.IsDNSTunnel() && t.Enabled {
				dnsTunnelCount++
			}
		}
		if dnsTunnelCount <= 1 {
			cfg.Route.Mode = "single"
			ctx.Output.Info("Switched to single-tunnel mode")
		}
	}
}
