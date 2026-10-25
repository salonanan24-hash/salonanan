import { useEffect, useState, useSyncExternalStore } from 'react';
import { adminRequest } from '@/admin/remote';
import { getBrowserSupabase } from '@/lib/supabase';
import type { ApiOrder } from '@/orders/api';

const seenKey = 'anan-seen-order-ids';

type Snapshot = {
  orders: ApiOrder[] | null;
  failed: boolean;
  unseen: ReadonlySet<string>;
};

let snapshot: Snapshot = { orders: null, failed: false, unseen: new Set() };
const listeners = new Set<() => void>();
let started = false;
let refreshing = false;
let queued = false;
let primed = false;
let knownIds = new Set<string>();
let pendingAlarm = false;
let audio: AudioContext | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  localStorage.setItem(seenKey, JSON.stringify([...ids]));
}

function unseenFrom(orders: ApiOrder[]) {
  const seen = readSeen();
  return new Set(orders.filter((order) => !seen.has(order.id)).map((order) => order.id));
}

function playAlarm() {
  const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  if (!audio) audio = new Context();
  if (audio.state !== 'running') {
    pendingAlarm = true;
    void audio.resume().then(() => {
      if (pendingAlarm && audio?.state === 'running') playAlarm();
    });
    return;
  }
  pendingAlarm = false;
  const now = audio.currentTime;
  for (let index = 0; index < 12; index += 1) {
    const tone = audio.createOscillator();
    const clash = audio.createOscillator();
    const gain = audio.createGain();
    tone.type = 'square';
    clash.type = 'square';
    tone.frequency.value = index % 2 === 0 ? 980 : 620;
    clash.frequency.value = index % 2 === 0 ? 740 : 490;
    const start = now + index * 0.17;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.7, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
    tone.connect(gain);
    clash.connect(gain);
    gain.connect(audio.destination);
    tone.start(start);
    clash.start(start);
    tone.stop(start + 0.16);
    clash.stop(start + 0.16);
  }
}

export function unlockOrderAlarm() {
  const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  if (!audio) audio = new Context();
  void audio.resume().then(() => {
    if (pendingAlarm && audio?.state === 'running') playAlarm();
  });
}

async function refresh() {
  if (refreshing) {
    queued = true;
    return;
  }
  refreshing = true;
  try {
    const result = await adminRequest<{ orders: ApiOrder[] }>('/api/admin/orders');
    const seen = readSeen();
    const arrivals = result.orders.filter((order) => primed && !knownIds.has(order.id) && !seen.has(order.id));
    if (!primed && localStorage.getItem(seenKey) === null) {
      writeSeen(new Set(result.orders.map((order) => order.id)));
    }
    knownIds = new Set(result.orders.map((order) => order.id));
    primed = true;
    snapshot = { orders: result.orders, failed: false, unseen: unseenFrom(result.orders) };
    emit();
    if (arrivals.length > 0) playAlarm();
  } catch {
    snapshot = { ...snapshot, failed: snapshot.orders === null };
    emit();
  } finally {
    refreshing = false;
    if (queued) {
      queued = false;
      void refresh();
    }
  }
}

export function startOrderWatch() {
  if (started) return;
  started = true;
  void refresh();
  const client = getBrowserSupabase();
  if (client) {
    client
      .channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        void refresh();
      })
      .subscribe();
  }
  window.setInterval(() => {
    void refresh();
  }, 4000);
}

export function markOrderSeen(id: string) {
  const seen = readSeen();
  seen.add(id);
  writeSeen(seen);
  const unseen = new Set(snapshot.unseen);
  unseen.delete(id);
  snapshot = { ...snapshot, unseen };
  emit();
}

export function useAdminOrders() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      startOrderWatch();
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
  return {
    orders: current.orders,
    failed: current.failed,
    unseen: current.unseen,
    reload: () => {
      void refresh();
    },
    markSeen: markOrderSeen,
  };
}

export function useRegisteredCustomers() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    adminRequest<{ count: number }>('/api/admin/customers/count')
      .then((result) => {
        if (active) setCount(result.count);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return count;
}
