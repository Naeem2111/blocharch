"use client";

import { useEffect, useRef, useState } from "react";

const COMPLETE_ANIM_MS = 420;

export function PlannerDoneToggle({
	checked,
	disabled,
	onToggle,
	title,
	onCompletingStart,
	onCompletingEnd,
}: {
	checked: boolean;
	disabled?: boolean;
	onToggle: (next: boolean) => void;
	title: string;
	onCompletingStart?: () => void;
	onCompletingEnd?: () => void;
}) {
	const [visualChecked, setVisualChecked] = useState(checked);
	const [animating, setAnimating] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!animating) setVisualChecked(checked);
	}, [checked, animating]);

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	function handleToggle() {
		if (disabled) return;

		if (checked) {
			if (timerRef.current) clearTimeout(timerRef.current);
			setAnimating(false);
			onCompletingEnd?.();
			setVisualChecked(false);
			onToggle(false);
			return;
		}

		setAnimating(true);
		setVisualChecked(true);
		onCompletingStart?.();
		timerRef.current = setTimeout(() => {
			timerRef.current = null;
			setAnimating(false);
			onCompletingEnd?.();
			onToggle(true);
		}, COMPLETE_ANIM_MS);
	}

	const showChecked = visualChecked || animating;

	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={checked}
			title={title}
			disabled={disabled}
			onClick={(e) => {
				e.stopPropagation();
				handleToggle();
			}}
			onPointerDown={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
			className={`planner-done-toggle mt-0.5 shrink-0 ${
				showChecked ? "planner-done-toggle-checked" : ""
			} ${animating ? "planner-done-toggle-animating" : ""}`}
		>
			<svg
				viewBox="0 0 12 12"
				className={`planner-done-check ${showChecked ? "planner-done-check-visible" : ""}`}
				aria-hidden
			>
				<path
					className="planner-done-check-path"
					d="M2 6l3 3 5-5"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	);
}
