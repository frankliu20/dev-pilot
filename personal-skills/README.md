# Personal Skills

This directory holds your **personal skills** — custom Claude Code skills that are
local to your machine and never pushed to the remote repository.

## How it works

1. Create a subdirectory here named after your skill (e.g., `my-helper/`)
2. Add a `SKILL.md` file inside it describing the skill
3. Run `node init.js --force` — your skill will be copied to `~/.claude/skills/<skill-name>/`

## Directory structure

```
personal-skills/
├── README.md            ← this file (tracked in git)
├── .gitkeep             ← keeps the directory visible in the repo
├── my-custom-skill/
│   └── SKILL.md
├── another-skill/
│   └── SKILL.md
└── scripts/             ← optional: personal scripts copied to ~/.claude/scripts/
    └── my-script.sh
```

## Notes

- Personal skills are installed **after** skill-pack skills, so they can
  override a pack skill by using the same directory name.
- No changes to `pilot.yaml` are needed — just drop files here and re-run init.
- Everything in this directory (except this README and `.gitkeep`) is gitignored.
