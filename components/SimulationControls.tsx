"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import type { ReactNode } from "react";
import type { Speed } from "@/lib/playback";

const SPEEDS: { value: Speed; label: string }[] = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
];

function ControlButton({
  label,
  icon,
  onClick,
  disabled,
  primary = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const look = primary
    ? "bg-blue text-midnight font-semibold hover:bg-[#a9c6ff] min-w-[6.25rem]"
    : "border border-line text-fg hover:border-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-control={label}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[3px] px-3.5 text-[0.9375rem] transition-colors disabled:pointer-events-none disabled:opacity-35 ${look}`}
    >
      {icon}
      {label}
    </button>
  );
}

interface SimulationControlsProps {
  name: string;
  running: boolean;
  finished: boolean;
  canStepBack: boolean;
  canStepForward: boolean;
  disabled: boolean;
  speed: Speed;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
  onSpeed: (speed: Speed) => void;
}

export function SimulationControls({
  name,
  running,
  finished,
  canStepBack,
  canStepForward,
  disabled,
  speed,
  onPlayPause,
  onPrevious,
  onNext,
  onRestart,
  onSpeed,
}: SimulationControlsProps) {
  const iconSize = 17;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3" data-controls={name}>
      <div className="flex flex-wrap items-center gap-2">
        <ControlButton
          label="Previous"
          icon={<SkipBack size={iconSize} aria-hidden />}
          onClick={onPrevious}
          disabled={disabled || !canStepBack}
        />
        <ControlButton
          primary
          label={running ? "Pause" : finished ? "Replay" : "Play"}
          icon={running ? <Pause size={iconSize} aria-hidden /> : <Play size={iconSize} aria-hidden />}
          onClick={onPlayPause}
          disabled={disabled}
        />
        <ControlButton
          label="Next"
          icon={<SkipForward size={iconSize} aria-hidden />}
          onClick={onNext}
          disabled={disabled || !canStepForward}
        />
        <ControlButton
          label="Restart"
          icon={<RotateCcw size={iconSize} aria-hidden />}
          onClick={onRestart}
          disabled={disabled}
        />
      </div>

      <fieldset className="flex items-center gap-3">
        <legend className="sr-only">Animation speed</legend>
        <span aria-hidden className="text-[0.9375rem] text-muted">
          Speed
        </span>
        <div className="flex rounded-[3px] border border-line">
          {SPEEDS.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer px-3 py-[0.4rem] text-[0.9375rem] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan ${
                speed === option.value ? "bg-fg/15 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              <input
                type="radio"
                name={`speed-${name}`}
                className="sr-only"
                value={option.value}
                checked={speed === option.value}
                onChange={() => onSpeed(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
