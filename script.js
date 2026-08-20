for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const label = button.querySelector("b");
    const originalLabel = label.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      label.textContent = "Copied";
      window.setTimeout(() => { label.textContent = originalLabel; }, 1600);
    } catch {
      label.textContent = "Select";
    }
  });
}

const trajectory = document.querySelector("[data-trajectory]");
if (trajectory) {
  const duration = 29_000;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const phaseLabel = trajectory.querySelector("[data-trajectory-phase]");
  const stateLabel = trajectory.querySelector("[data-trajectory-state]");
  const stageLabel = trajectory.querySelector("[data-demo-stage-label]");
  const targetLabel = trajectory.querySelector("[data-demo-target-label]");
  const targetNative = trajectory.querySelector("[data-demo-target-native]");
  const progress = trajectory.querySelector("[data-trajectory-progress]");
  const lineContainer = trajectory.querySelector("[data-trajectory-lines]");
  const pauseButton = trajectory.querySelector('[data-trajectory-action="pause"]');
  const replayButton = trajectory.querySelector('[data-trajectory-action="replay"]');
  const afterImage = document.querySelector("[data-demo-after-image]");
  const afterCaption = document.querySelector("[data-demo-after-caption]");
  let target = "pi";
  let elapsed = motion.matches ? duration - 1 : 0;
  let paused = motion.matches;
  let reduced = motion.matches;
  let inView = false;
  let previous = performance.now();

  const details = {
    pi: { label: "Pi", native: "native v3 JSONL", reply: "Continued in Pi.", resume: "pi --session 20000000-…", image: "/assets/demo-after-pi.png?v=3" },
    codex: { label: "Codex", native: "native rollout JSONL", reply: "Continued in Codex.", resume: "codex resume 30000000-…", image: "/assets/demo-after-codex.png?v=3" },
  };

  const linesFor = (value) => {
    const item = details[value];
    return [
      [250, "meta", "CLAUDE", "native session · conversation loaded", false],
      [900, "command", "YOU", 'Reply with exactly "Migration begins in Claude."', true],
      [4500, "history", "CLAUDE", "Migration begins in Claude.", false],
      [6200, "command", "❯", `smigrate transfer 10000000-… --from claude --to ${value}`, true],
      [9600, "success", "✓", `native ${item.label} session created · source unchanged`, false],
      [11300, "meta", item.label.toUpperCase(), "migrated conversation opened in the native TUI", false],
      [12300, "history", "YOU", "Continue after the synthetic compaction.", false],
      [13500, "history", "CLAUDE", "The synthetic post-compaction fixture is complete.", false],
      [14700, "history", "YOU", 'Reply with exactly "This native session is ready."', false],
      [15900, "history", "CLAUDE", "This native session is ready.", false],
      [17100, "history", "YOU", 'Reply with exactly "Migration begins in Claude."', false],
      [18300, "history", "CLAUDE", "Migration begins in Claude.", false],
      [20000, "command", "YOU", `Reply with exactly "Continued in ${item.label}."`, true],
      [23500, "success", item.label.toUpperCase(), item.reply, false],
      [25500, "success", "RESUME", item.resume, false],
    ];
  };

  const phaseFor = (value) => {
    if (value < 6200) return "claude";
    if (value < 11300) return "migrate";
    if (value < 20000) return "review";
    if (value < 25500) return "continue";
    return "ready";
  };

  const buildLines = () => {
    lineContainer.replaceChildren();
    for (const [at, kind, prefix, text, typed] of linesFor(target)) {
      const line = document.createElement("div");
      line.className = `trajectory-line ${kind}`;
      line.dataset.at = String(at);
      line.dataset.text = text;
      if (typed) line.dataset.typed = "true";
      const prefixElement = document.createElement("span");
      prefixElement.textContent = prefix;
      const code = document.createElement("code");
      code.textContent = text;
      line.append(prefixElement, code);
      if (typed) {
        const cursor = document.createElement("i");
        cursor.className = "trajectory-cursor";
        line.append(cursor);
      }
      lineContainer.append(line);
    }
  };

  const renderTrajectory = () => {
    const phase = phaseFor(elapsed);
    const item = details[target];
    trajectory.dataset.phase = phase;
    trajectory.dataset.target = target;
    phaseLabel.textContent = phase;
    stateLabel.textContent = phase === "ready" ? "continued" : "live · 1×";
    stageLabel.textContent = phase === "claude" ? "Claude Code" : phase === "migrate" ? "session-migrate" : item.label;
    targetLabel.textContent = item.label;
    targetNative.textContent = item.native;
    progress.style.width = `${Math.min(100, elapsed / duration * 100)}%`;

    for (const line of lineContainer.querySelectorAll(".trajectory-line")) {
      const at = Number(line.dataset.at);
      const text = line.dataset.text;
      const visible = reduced || elapsed >= at;
      const code = line.querySelector("code");
      const cursor = line.querySelector(".trajectory-cursor");
      line.classList.toggle("is-visible", visible);
      if (line.dataset.typed === "true" && !reduced) {
        const length = Math.max(0, Math.floor((elapsed - at) / 45));
        code.textContent = visible ? text.slice(0, length) : "";
        if (cursor) cursor.hidden = !visible || length >= text.length;
      } else {
        code.textContent = text;
        if (cursor) cursor.hidden = true;
      }
    }

    pauseButton.textContent = reduced ? "Play" : paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-label", paused ? "Resume trajectory animation" : "Pause trajectory animation");
  };

  const selectTarget = (value) => {
    target = value;
    reduced = false;
    paused = false;
    elapsed = 0;
    for (const button of document.querySelectorAll("[data-demo-target]")) {
      const active = button.dataset.demoTarget === value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    const item = details[value];
    afterImage.src = item.image;
    afterImage.alt = `${item.label} native TUI after migration from Claude Code`;
    afterCaption.textContent = `After · ${item.label} TUI`;
    buildLines();
    renderTrajectory();
  };

  const tick = (now) => {
    const delta = Math.min(100, now - previous);
    previous = now;
    if (!paused && !reduced && inView) elapsed = (elapsed + delta) % duration;
    renderTrajectory();
    window.requestAnimationFrame(tick);
  };

  for (const button of document.querySelectorAll("[data-demo-target]")) {
    button.addEventListener("click", () => selectTarget(button.dataset.demoTarget));
  }

  pauseButton.addEventListener("click", () => {
    if (reduced) {
      reduced = false;
      elapsed = 0;
      paused = false;
    } else {
      paused = !paused;
    }
    renderTrajectory();
  });

  replayButton.addEventListener("click", () => {
    reduced = false;
    elapsed = 0;
    paused = false;
    renderTrajectory();
  });

  motion.addEventListener("change", (event) => {
    reduced = event.matches;
    paused = event.matches;
    elapsed = event.matches ? duration - 1 : 0;
    renderTrajectory();
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => { inView = entry.isIntersecting; },
      { threshold: 0.25 },
    );
    observer.observe(trajectory);
  } else {
    inView = true;
  }

  buildLines();
  renderTrajectory();
  window.requestAnimationFrame(tick);
}
