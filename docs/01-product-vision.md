# Product Vision

## Working description

Computer OSS is an open-source, self-hosted control plane for long-running AI work. A user describes an outcome. The system decides what should be delegated, decomposes it into parallelizable tasks, routes those tasks across the best available models and runtimes, preserves state across runs, and returns artifacts plus only the decisions that need human approval.

## Problem

Frontier models are increasingly capable, but the products around them still fail in three places:

- they make the user decide what to delegate
- they create chaos when many agents run in parallel
- they lose state, context, and accountability across long-running work

Existing agent frameworks expose primitives. Existing chat tools expose answers. The gap is an assembled system that can run multi-step work for hours or days without collapsing into prompt spaghetti.

## Product promise

`Your keys. Your models. Your data.`

The open-source wedge is not "free Perplexity." The wedge is control:

- bring your own API keys
- choose your own model routing
- run on your own infra
- keep your own artifacts, logs, and memory

## V1 scope

V1 is explicitly:

- self-hosted
- single workspace, but multi-workspace ready in schema
- browser + files + terminal + APIs + document generation
- interactive, background, and scheduled execution
- web command center plus Slack and Telegram adapters
- approval-gated for side effects
- based on independent worker runtimes

## V1 non-goals

Do not build these into v1:

- generic consumer assistant shell
- voice, mobile, or canvas-first experiences
- arbitrary native desktop automation
- hidden model routing magic with opaque costs
- a reusable agent framework as the primary product

## Primary user jobs

- turn a vague outcome into an executable plan
- run many subtasks in parallel across providers
- maintain coherent memory and artifacts across runs
- safely approve writes, mutations, and privileged actions
- resume interrupted work without losing context

## Design principles

- `Outcome first`: an outcome is the dominant workflow object.
- `Visible routing`: users should be able to see and change routing policy.
- `Reviewable execution`: outputs, logs, artifacts, and approvals must be inspectable.
- `Isolation by default`: work runs in isolated environments with bounded authority.
- `Same pipeline everywhere`: interactive, background, and scheduled runs use the same execution path.

## Success criteria for v1

- a user can describe an outcome and receive a visible plan graph
- independent nodes execute in parallel across configured providers
- side effects pause for approval and resume correctly
- artifacts remain attached to the outcome and survive restarts
- the same outcome can continue across web and messaging surfaces
