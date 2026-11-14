# VLA agents for observing, testing and critiquing the game

How an embodied model could watch HANDS ON!, play it, and tell us what is
wrong — and what is actually worth building before the jam deadline.

## Short version

- A pretrained VLA will not play this game out of the box. Pixel-to-action
  policies are trained on robot arms and on keyboard-and-mouse games; this
  game takes tracked controller poses, a trigger, a grip and two thumbsticks.
  The published benchmarks put zero-shot transfer to an unseen action space
  near chance ([MultiNet v0.2](https://pith.science/paper/2505.05540)), and
  training one takes hours of demonstrations
  ([Script2Play](https://arxiv.org/abs/2611.11136) needed 150 hours to reach
  69.6% on Minecraft-family tasks).
- The useful split is **vision model judges, scripted or agentic hands**. The
  vision half is cheap and available today; the action half is a small,
  well-defined adapter over the harness we already have.
- The gap in this repository is not action, it is *looking*. `qa:critic`
  measures pixels (byte size, blank detection) and `audit_hand` measures
  state, but nothing compares a screenshot against what the
  [specification](SPECIFICATION.md) says should be on screen. A vision model
  reading `qa-out/*.png` plus the state JSON closes that gap for cents per
  run.
- Recommended order: **(1) VLM critic over the existing captures, (2) an MCP
  agent player that explores, (3) a trained VLA only if the jam ships early.**
  Only (1) and (2) fit the remaining time.

## The three things people mean by "VLA"

| Meaning | What it is | Fits this project? |
|---------|------------|--------------------|
| Vision-language-action policy | One network mapping frames + instruction to actions (OpenVLA, π0.5, GR00T, SmolVLA) | Only after fine-tuning on recorded rollouts |
| Vision-language model as judge | A model that looks at a frame and reasons about it, no action head | Yes, today, cheapest quality gain |
| Vision-language-agent loop | A VLM plus a tool belt, choosing one action per frame in a ReAct loop | Yes, today, over the existing MCP server |

## What the harness already gives us

Deterministic, already green in CI:

- `scripts/critic.mjs` — boots the built game headless, completes the hand,
  captures 2-6 views into `qa-out/`, prints a verdict. ~13 s and ~1.5 GB per
  run; three concurrent runs is the ceiling on this VM.
- `scripts/qa-mcp-server.mjs` — the `hands-on-qa` MCP server: `read_state`,
  `audit_hand`, `parts`, `screenshot`, `pose`, `stick`, `trigger`,
  `squeeze`, `a_button`, `b_button`, `page_errors`. This is an action space
  an agent can already drive, expressed in world coordinates.
- `scripts/validate-hand.mjs` — geometry proof: UVs, triangle budgets, screw
  anchors on the surface and pointing outward.
- `tests/e2e/xr-assembly.spec.ts` — the start-to-finish playthrough oracle:
  grab, snap, drive 25 screws, rebuild, audio trace, texture budget.

What is missing: **semantic judgement of what a capture shows.** The token
budget is fine, the state is already serialised, only a reader is absent.

## Tier 1 — VLM critic (built: `npm run qa:vlm`)

`scripts/vlm-critic.mjs` sends each capture, the state snapshot and ten
checkable claims from `docs/SPECIFICATION.md` to a vision model and demands
strict JSON: for each claim, `satisfied | violated | unverifiable` with the
shot it is based on, and for each violation a severity and a one-line fix.
Three samples per run, majority vote, non-zero exit on a high-severity
violation or a page error. A two-shot run costs about $0.002.

It paid for itself on the first run, by finding two harness bugs rather than
game bugs: every capture had been taken through the credits splash (the
splash is scheduled on a timer after boot and again on completion, so an
early skip did nothing), and the desktop `ENTER VR` HUD was in frame. Both
are now cleared and re-verified before the shutter, which also means every
earlier visual judgement of this project was made through a panel — worth
knowing before trusting an old screenshot.

Why it works here:

- The claims are already written down and checkable ("the palm stands on the
  pedestal", "two rows of six mannequins", "arrows mark each undriven
  screw", "the upper cover hides the servos").
- Captures are deterministic, so a regression is a diff of two runs, not a
  vibe.
- Cost is trivial: about 1-2k image tokens per 960x540 shot, so a five-shot
  run on `qwen/qwen3-vl-30b-a3b-instruct` ($0.15 / $0.60 per million tokens)
  is under a cent. Escalate a single suspicious shot to a stronger model
  instead of re-running everything.

Guardrails that matter more than the model choice:

- **Evidence rule.** A finding is only actionable if a scripted probe can
  reproduce it. "Screw floats 3 cm above the palm" must be checkable in
  `parts.json` anchors or `read_state` bounds; if it is not, it is a note,
  not a failure.
- **Two-thirds majority.** Ask for the same verdict three times at
  temperature 0 and require agreement before failing a gate; single-sample
  VLM verdicts drift with prompt order.
- **Never the only gate.** A 960x540 software-WebGL capture is not a Quest
  panel: text legibility, aliasing, bloom and comfort cannot be judged from
  it. Keep the deterministic oracles authoritative and treat the critic as
  an early-warning system.

## Tier 2 — Agentic player (build next)

A VLM in a ReAct loop over the `hands-on-qa` MCP tools. This is exactly the
shape of [VG-Agent](https://www.alphaxiv.org/abs/2505.18134): think, pick one
tool call, observe, repeat. Because the tools take world coordinates and the
game answers with structured state, the loop needs no pixel-level precision —
the agent decides *what* to try, the mock controllers execute it.

Action-space mapping, which is the whole adapter:

| Embodied action | Tool call |
|-----------------|-----------|
| End-effector pose delta, 6-DoF | `pose side=left pos=[x,y,z] yaw=deg pitch=deg` |
| Gripper close / open | `trigger side=left value=1` then `0`, or `squeeze` |
| Locomotion | `stick side=left x=.. y=..` |
| Tool selection | `b_button side=right value=1` then `0` |
| Menu / confirm | `a_button side=side value=1` then `0` |
| Observation | `screenshot`, `read_state`, `parts`, `audio_channels` |
| Reward signal | `audit_hand`, `read_state.statusText`, `page_errors` |

Use it for exploration, not scoring: the agent's job is to find the paths we
did not script (does undo survive a rebuild? does the menu stay reachable
mid-carry? can a part be wedged under the conveyor?), then a human or a
scripted test turns each find into a deterministic test. Budget it: a 30-step
episode at 2-4 s per step is 1-2 minutes and a few cents.

## Tier 3 — Trained VLA policy (only if there is time)

Feasible in principle, expensive in practice:

1. Record demonstrations: the MCP server already emits pose/trigger
   trajectories, so a scripted expert can produce 100+ successful builds
   with exact actions and frames.
2. Adapter: 7-D action (Δposition in metres, Δyaw/Δpitch in radians, trigger,
   grip), normalised per the level's reach envelope. Frames: 320x240 stereo or
   mono; the Quest pass is the same camera path.
3. Fine-tune a small open model (SmolVLA, OpenVLA-7B, π0.5) with LoRA on that
   set, then evaluate against `audit_hand` — the oracle is already exact, so
   success rate needs no human labels.
4. Expect the numbers from the literature, not the demo videos: π0.5 leads an
   SO-101 benchmark at 56% average with a 31% recovery rate
   ([SO-101 study](https://arxiv.org/html/2606.08881v2)); VLAs lose 50-100%
   success under visual perturbations that barely dent their VLM backbone
   ([VLA-Arena](https://en.papernotes.org/ICML2026/multimodal_vlm/vla-arena_an_open-source_framework_for_benchmarking_vision-language-action_model/)).

Two consequences for us: a 30% failure rate is useless as a *gate* but useful
as a *fuzzer* (failures cluster around contact precision and drop recovery,
which is exactly where a headset player gets frustrated), and any trained
policy must keep its VLM half frozen or it will lose the general visual
grounding it needs under a new palette.

## Model availability, measured today

From `GET https://openrouter.ai/api/v1/models`: 471 models, 325 accept
images, **none** is a VLA or robotics policy — OpenRouter routes chat
completion models, and an action head has nothing to be routed. Practical
tiers:

| Purpose | Model | In / out per Mtok |
|---------|-------|-------------------|
| Cheap regression critic | `qwen/qwen3-vl-30b-a3b-instruct` | $0.15 / $0.60 |
| Stronger spatial reading | `qwen/qwen3-vl-235b-a22b-instruct` | $0.21 / $1.90 |
| Escalation, hard layout questions | `google/gemini-4-hydrogen` | $1.50 / $7.50 |
| Agentic loop with tool calls | `anthropic/claude-haiku-5.5` | $0.10 / $0.50 |

A self-hosted VLA means weights, a GPU and a licence review — OpenVLA, π0.5
and GR00T each carry their own terms, and this repo's asset policy already
requires explicit approval for anything new. Not a jam-week decision.

## Metrics that decide whether any of this helps

- **Oracle agreement.** On runs where `audit_hand` and the E2E pass, the VLM
  critic must also pass. Every disagreement is either a critic bug or a real
  spec gap; both are worth fixing.
- **Regression catch rate.** Plant a known defect (swap two screw anchors,
  hide a mannequin, make the cover transparent) and confirm the critic names
  it from pixels alone. Ten planted defects is a decent calibration set.
- **Signal the scripted gates miss.** Count distinct findings that no existing
  test would have caught. If that stays at zero after ten runs, the critic is
  decoration.
- **Cost and wall time per run**, so it can stay in CI without a budget
  debate.

## Risks and how to keep them small

- **Sycophancy.** Asked "does this look right?", VLMs yes-man. Ask for
  violations of specific claims and for `unverifiable` when the shot cannot
  show it; score `unverifiable` separately, never as a pass.
- **Screenshot bias.** Desktop capture, software rasteriser, no foveation, no
  headset ergonomics. Keep human headset passes for comfort and legibility.
- **Nondeterminism.** Temperature 0, fixed prompt, majority vote, and pin the
  model id in the script so a silent provider upgrade cannot flip a gate.
- **Latency in CI.** A vision call is 2-5 s per shot; run it after the fast
  gates, on the same captures, with `continue-on-error: false` only for the
  majority-voted high-severity findings.
- **Authority.** The critic never replaces `audit_hand`, `qa:geometry` or the
  E2E playthrough. Those are oracles; the critic is an observer.
