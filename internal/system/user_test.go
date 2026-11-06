package system

import (
	"strings"
	"testing"
)

// cloudSSHDConfig is the start of a stock Ubuntu cloud image's sshd_config,
// whose include turns password logins off.
const cloudSSHDConfig = `Include /etc/ssh/sshd_config.d/*.conf

KbdInteractiveAuthentication no
UsePAM yes
`

// oldAuraBlock is the Match block before password logins were enabled.
const oldAuraBlock = `
# Aura SSH tunnel users
Match Group aura-ssh
    AllowTcpForwarding yes
    X11Forwarding no
    AllowAgentForwarding no
    ForceCommand /bin/false
    ClientAliveInterval 30
    ClientAliveCountMax 10
`

func TestAuraSSHConfigFresh(t *testing.T) {
	got := withAuraSSHConfig(cloudSSHDConfig)
	if !strings.HasPrefix(got, cloudSSHDConfig) || !strings.HasSuffix(got, sshMatchBlock) {
		t.Fatalf("got:\n%s", got)
	}
	if g, m := strings.Index(got, "# Aura global SSH settings"), strings.Index(got, "Match Group"); g < 0 || g > m {
		t.Errorf("global settings missing or after the Match block:\n%s", got)
	}
}

func TestAuraSSHConfigUpgradesOldBlock(t *testing.T) {
	got := withAuraSSHConfig(cloudSSHDConfig + sshGlobalSettings + oldAuraBlock)
	if n := strings.Count(got, "Match Group aura-ssh"); n != 1 {
		t.Fatalf("%d Match blocks:\n%s", n, got)
	}
	if !strings.HasSuffix(got, sshMatchBlock) || strings.Count(got, "# Aura global SSH settings") != 1 {
		t.Errorf("got:\n%s", got)
	}
}

func TestAuraSSHConfigIdempotent(t *testing.T) {
	once := withAuraSSHConfig(cloudSSHDConfig)
	if twice := withAuraSSHConfig(once); twice != once {
		t.Errorf("second pass changed the config:\n%s", twice)
	}
}

func TestAuraSSHConfigKeepsForeignBlock(t *testing.T) {
	in := cloudSSHDConfig + sshGlobalSettings + "\nMatch Group aura-ssh\n    AllowTcpForwarding yes\n"
	if got := withAuraSSHConfig(in); got != in {
		t.Errorf("hand-written block replaced:\n%s", got)
	}
}

func TestAuraSSHConfigGlobalsBeforeOtherMatch(t *testing.T) {
	in := cloudSSHDConfig + "\nMatch User backup\n    ForceCommand /usr/bin/rsync\n"
	got := withAuraSSHConfig(in)
	if g, m := strings.Index(got, "# Aura global SSH settings"), strings.Index(got, "Match User backup"); g < 0 || g > m {
		t.Errorf("global settings after an existing Match block:\n%s", got)
	}
}
