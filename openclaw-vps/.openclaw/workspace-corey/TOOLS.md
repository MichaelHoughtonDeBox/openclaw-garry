# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## Corey Marketing Skill Access

These skills are available in this workspace under `.agents/skills/*/SKILL.md`.
Read the relevant `SKILL.md` before execution when a task matches the trigger.

- **Context and strategy:** `product-marketing-context`, `content-strategy`, `launch-strategy`, `pricing-strategy`, `marketing-ideas`, `marketing-psychology`, `free-tool-strategy`
- **Acquisition and channels:** `programmatic-seo`, `seo-audit`, `schema-markup`, `paid-ads`, `social-content`, `email-sequence`, `referral-program`
- **Conversion optimization:** `page-cro`, `form-cro`, `popup-cro`, `signup-flow-cro`, `onboarding-cro`, `paywall-upgrade-cro`, `ab-test-setup`, `analytics-tracking`
- **Messaging and positioning:** `copywriting`, `copy-editing`, `competitor-alternatives`

Operational note:
- `mongo-mission-control` is available for Mission Control task workflow and artifact delivery, but it is not a marketing strategy skill.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
