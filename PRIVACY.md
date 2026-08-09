# Riqor Privacy Policy

Last updated: 9 August 2026

Riqor is an open-source developer tool and plugin published from this repository. This policy describes the data behavior of the Riqor code distributed through npm and the ChatGPT/Codex plugin package. It does not replace the privacy policies of OpenAI, GitHub, npm, an operating-system vendor, or any other service through which you obtain or run Riqor.

## Data Riqor processes

Riqor Skills are packaged instructions executed by the host surface. Riqor lifecycle hooks can receive host event data needed to route work and enforce evidence or continuity checks. For example, a prompt may be examined transiently to choose relevant execution guidance. Riqor is designed so its durable local trace state does not store raw prompts, chat transcripts, source-file contents, command output, environment values, credentials, cookies, or authentication tokens.

The local npm runtime stores bounded operational metadata needed for installation, diagnostics, managed Codex configuration, and local state. Riqor 0.2.4 also includes an offline adoption ledger that stores coarse counters such as first-seen version, current version, active days, session count, agent starts, and supported Skill counters. Its installation identifier is randomly generated locally and is not derived from a user account or hardware identifier.

## No Riqor telemetry service

Riqor 0.2.4 does not send the offline adoption ledger to a Riqor analytics server and does not contain a hidden install-tracking pixel or phone-home endpoint. Public ChatGPT Plugin Directory install counts are therefore not inferred from the local ledger. If a future release introduces optional remote aggregation, it requires an explicit opt-in design and a corresponding policy update before release.

## Local storage and deletion

Local state is stored under Riqor-managed user data or state directories, or under the host-provided `PLUGIN_DATA` directory when a plugin hook is allowed to persist bounded local state. File permissions and ownership checks are used where applicable. You can remove the offline adoption ledger with `riqor adoption --reset`. Other Riqor-managed installation files can be removed with the documented uninstall command or by deleting the corresponding local Riqor data after the process is stopped.

## Third-party services

When you use Riqor through ChatGPT, Codex, GitHub, npm, or another host, that service may process data independently under its own terms and privacy policy. Riqor does not control the host service's collection, retention, training, logging, security, or account behavior.

## Security reports and questions

For security-sensitive reports, follow `SECURITY.md` rather than posting secrets or exploit details in a public issue. For privacy questions or non-sensitive support, use the public support process described in `SUPPORT.md`.
