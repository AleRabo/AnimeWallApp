'use client';

import { useEffect } from 'react';

export type GamepadAction =
  | 'navigate-up'
  | 'navigate-down'
  | 'navigate-left'
  | 'navigate-right'
  | 'confirm'
  | 'back'
  | 'previous-section'
  | 'next-section'
  | 'remove-selected'
  | 'play-pause'
  | 'seek-backward'
  | 'seek-forward'
  | 'volume-down'
  | 'volume-up'
  | 'previous-episode'
  | 'next-episode'
  | 'toggle-fullscreen';

const actionEventName = 'animewall-gamepad-action';

function emitAction(action: GamepadAction) {
  window.dispatchEvent(new CustomEvent<GamepadAction>(actionEventName, { detail: action }));
  handleNavigationAction(action);
}

function visibleFocusableElements() {
  return Array.from(document.querySelectorAll<HTMLElement>(
    'a[href], button, select, input, [tabindex]:not([tabindex="-1"])'
  )).filter((element) => {
    const bounds = element.getBoundingClientRect();
    return !element.hasAttribute('disabled')
      && bounds.width > 0
      && bounds.height > 0
      && getComputedStyle(element).visibility !== 'hidden';
  });
}

function navigationScope(element: HTMLElement | null) {
  if (element?.closest('main')) return document.querySelector('main');
  if (element?.closest('aside')) return document.querySelector('aside');
  if (element?.closest('header')) return document.querySelector('header');
  return null;
}

function moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
  const current = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const scope = navigationScope(current);
  const allElements = visibleFocusableElements();
  const elements = scope
    ? allElements.filter((element) => scope.contains(element))
    : allElements.filter((element) => !element.closest('header, aside'));
  if (elements.length === 0) return;

  if (!current || !elements.includes(current)) {
    elements[0].focus();
    elements[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }

  const currentBounds = current.getBoundingClientRect();
  const currentCenter = {
    x: currentBounds.left + currentBounds.width / 2,
    y: currentBounds.top + currentBounds.height / 2
  };
  const candidates = elements
    .filter((element) => element !== current)
    .map((element) => {
      const bounds = element.getBoundingClientRect();
      const center = {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2
      };
      const deltaX = center.x - currentCenter.x;
      const deltaY = center.y - currentCenter.y;
      const isInDirection = direction === 'left' ? deltaX < -4
        : direction === 'right' ? deltaX > 4
          : direction === 'up' ? deltaY < -4
            : deltaY > 4;
      if (!isInDirection) return null;

      const isHorizontal = direction === 'left' || direction === 'right';
      const primaryDistance = isHorizontal ? Math.abs(deltaX) : Math.abs(deltaY);
      const secondaryDistance = isHorizontal ? Math.abs(deltaY) : Math.abs(deltaX);
      const currentRange = isHorizontal
        ? { start: currentBounds.top, end: currentBounds.bottom }
        : { start: currentBounds.left, end: currentBounds.right };
      const candidateRange = isHorizontal
        ? { start: bounds.top, end: bounds.bottom }
        : { start: bounds.left, end: bounds.right };
      const overlaps = candidateRange.start < currentRange.end
        && candidateRange.end > currentRange.start;
      return {
        element,
        score: primaryDistance + secondaryDistance * (overlaps ? 0.8 : 5)
      };
    })
    .filter((candidate): candidate is { element: HTMLElement; score: number } => candidate !== null)
    .sort((first, second) => first.score - second.score);

  const target = candidates[0]?.element;
  if (!target) return;
  target.focus();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function activateFocusedElement() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    if (active.closest('[data-continue-card]') && active.closest('button')) return;
    active.click();
    return;
  }
  visibleFocusableElements()[0]?.focus();
}

function moveSectionFocus(direction: 'previous' | 'next') {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(
    'header nav a[href]'
  ));
  if (sections.length === 0) return;

  const focusedIndex = sections.indexOf(document.activeElement as HTMLElement);
  const routeIndex = sections.findIndex(
    (section) => section instanceof HTMLAnchorElement && section.pathname === window.location.pathname
  );
  const currentIndex = focusedIndex >= 0 ? focusedIndex : routeIndex;
  const nextIndex = currentIndex < 0
    ? (direction === 'next' ? 0 : sections.length - 1)
    : (currentIndex + (direction === 'next' ? 1 : -1) + sections.length) % sections.length;
  const target = sections[nextIndex];
  if (!target) return;
  target.click();
  window.setTimeout(() => {
    const firstContentElement = document.querySelector<HTMLElement>(
      'main a[href], main button, main select, main input, main [tabindex]:not([tabindex="-1"])'
    );
    firstContentElement?.focus();
  }, 150);
}

function handleNavigationAction(action: GamepadAction) {
  if (action === 'navigate-up' || action === 'navigate-down'
    || action === 'navigate-left' || action === 'navigate-right') {
    moveFocus(action.replace('navigate-', '') as 'up' | 'down' | 'left' | 'right');
    return;
  }
  if (action === 'confirm') {
    activateFocusedElement();
    return;
  }
  if (action === 'previous-section' || action === 'next-section') {
    moveSectionFocus(action === 'next-section' ? 'next' : 'previous');
    return;
  }
  if (action === 'back') {
    window.history.back();
  }
}

export function useGamepad() {
  useEffect(() => {
    if (!('getGamepads' in navigator)) return;

    const previousButtons = new Map<number, boolean[]>();
    const heldActions = new Map<GamepadAction, number>();
    let animationFrame = 0;

    const dispatchHeldAction = (action: GamepadAction, pressed: boolean, now: number) => {
      if (!pressed) {
        heldActions.delete(action);
        return;
      }

      const lastDispatch = heldActions.get(action);
      if (lastDispatch === undefined || now - lastDispatch >= 260) {
        heldActions.set(action, now);
        handleNavigationAction(action);
      }
    };

    const poll = (now: number) => {
      const gamepads = navigator.getGamepads();
      const gamepad = Array.from(gamepads).find(Boolean);
      if (gamepad) {
        const previous = previousButtons.get(gamepad.index) || [];
        const pressed = gamepad.buttons.map((button) => button.pressed || button.value > 0.35);
        const justPressed = (index: number) => Boolean(pressed[index] && !previous[index]);
        const axisX = gamepad.axes[0] || 0;
        const axisY = gamepad.axes[1] || 0;

        if (justPressed(0)) emitAction('confirm');
        if (justPressed(1)) emitAction('back');
        if (justPressed(2)) emitAction('confirm');
        if (justPressed(3)) {
          emitAction(
            document.activeElement?.closest('[data-continue-card]')
              ? 'remove-selected'
              : 'toggle-fullscreen'
          );
        }
        const playerIsFocused = document.activeElement?.closest('[data-gamepad-player]');
        if (justPressed(4)) {
          emitAction(playerIsFocused ? 'previous-episode' : 'previous-section');
        }
        if (justPressed(5)) {
          emitAction(playerIsFocused ? 'next-episode' : 'next-section');
        }
        if (justPressed(6)) emitAction('seek-backward');
        if (justPressed(7)) emitAction('seek-forward');
        if (justPressed(9)) emitAction('play-pause');

        dispatchHeldAction('navigate-up', pressed[12] || axisY < -0.55, now);
        dispatchHeldAction('navigate-down', pressed[13] || axisY > 0.55, now);
        dispatchHeldAction('navigate-left', pressed[14] || axisX < -0.55, now);
        dispatchHeldAction('navigate-right', pressed[15] || axisX > 0.55, now);
        previousButtons.set(gamepad.index, pressed);
      }

      animationFrame = window.requestAnimationFrame(poll);
    };

    const onGamepadConnected = () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !visibleFocusableElements().includes(active)) {
        const firstContentElement = document.querySelector<HTMLElement>(
          'main a[href], main button, main select, main input, main [tabindex]:not([tabindex="-1"])'
        );
        (firstContentElement || visibleFocusableElements()[0])?.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      event.target.dataset.gamepadFocused = 'true';
      event.target.closest<HTMLElement>('[data-continue-card]')?.setAttribute('data-gamepad-card-focused', 'true');
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      delete event.target.dataset.gamepadFocused;
      const card = event.target.closest<HTMLElement>('[data-continue-card]');
      if (!card || card.contains(event.relatedTarget as Node | null)) return;
      card.removeAttribute('data-gamepad-card-focused');
    };

    window.addEventListener('gamepadconnected', onGamepadConnected);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    animationFrame = window.requestAnimationFrame(poll);
    return () => {
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return actionEventName;
}

export function useGamepadAction(action: GamepadAction, handler: () => void) {
  useEffect(() => {
    const listener = (event: Event) => {
      if ((event as CustomEvent<GamepadAction>).detail === action) handler();
    };
    window.addEventListener(actionEventName, listener);
    return () => window.removeEventListener(actionEventName, listener);
  }, [action, handler]);
}
