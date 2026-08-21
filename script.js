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
  const video = trajectory.querySelector("[data-demo-video]");
  const source = trajectory.querySelector("[data-demo-video-source]");
  const progress = trajectory.querySelector("[data-trajectory-progress]");
  const pauseButton = trajectory.querySelector('[data-trajectory-action="pause"]');
  const replayButton = trajectory.querySelector('[data-trajectory-action="replay"]');
  const targetLabel = trajectory.querySelector("[data-demo-target-label]");
  const speedLabel = trajectory.querySelector("[data-demo-speed]");
  const afterImage = document.querySelector("[data-demo-after-image]");
  const afterCaption = document.querySelector("[data-demo-after-caption]");

  const details = {
    pi: {
      label: "Pi",
      video: "/assets/demo-pi.mp4?v=5",
      image: "/assets/demo-after-pi.png?v=5",
    },
    codex: {
      label: "Codex",
      video: "/assets/demo-codex.mp4?v=5",
      image: "/assets/demo-after-codex.png?v=5",
    },
  };

  const updatePlaybackState = () => {
    pauseButton.textContent = video.paused ? "Play" : "Pause";
    pauseButton.setAttribute(
      "aria-label",
      video.paused ? "Play native TUI recording" : "Pause native TUI recording",
    );
  };

  const selectTarget = (target) => {
    const detail = details[target];
    trajectory.dataset.target = target;
    for (const button of document.querySelectorAll("[data-demo-target]")) {
      const active = button.dataset.demoTarget === target;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    source.src = detail.video;
    video.setAttribute(
      "aria-label",
      `Real terminal recording of a Claude Code session migrated to ${detail.label} and continued there`,
    );
    video.load();
    void video.play().catch(() => updatePlaybackState());
    targetLabel.textContent = detail.label;
    speedLabel.textContent = `Claude 2× · ${detail.label} 1×`;
    afterImage.src = detail.image;
    afterImage.alt = `${detail.label} native TUI after migration from Claude Code`;
    afterCaption.textContent = `After · ${detail.label} TUI`;
  };

  for (const button of document.querySelectorAll("[data-demo-target]")) {
    button.addEventListener("click", () => selectTarget(button.dataset.demoTarget));
  }

  pauseButton.addEventListener("click", () => {
    if (video.paused) void video.play();
    else video.pause();
  });
  replayButton.addEventListener("click", () => {
    video.currentTime = 0;
    void video.play();
  });
  video.addEventListener("play", updatePlaybackState);
  video.addEventListener("pause", updatePlaybackState);
  video.addEventListener("timeupdate", () => {
    progress.style.width = `${video.duration ? video.currentTime / video.duration * 100 : 0}%`;
  });
  updatePlaybackState();
}
