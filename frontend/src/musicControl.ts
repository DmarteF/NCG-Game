type Listener = (action: 'suspend' | 'restore') => void;

const listeners = new Set<Listener>();

export function subscribeGlobalMusic(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function suspendGlobalMusic() {
  listeners.forEach(listener => listener('suspend'));
}

export function restoreGlobalMusic() {
  listeners.forEach(listener => listener('restore'));
}
