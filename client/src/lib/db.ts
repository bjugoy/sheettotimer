import { supabase } from './supabase';
import type { ScheduleItem } from '@program-timer/shared';

async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  return session.user.id;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Production {
  id:         string;
  user_id:    string;
  name:       string;
  created_at: string;
}

export interface Event {
  id:            string;
  production_id: string;
  user_id:       string;
  name:          string;
  schedule:      ScheduleItem[];
  created_at:    string;
}

// ── Productions ───────────────────────────────────────────────────────────────

export async function getProductions(): Promise<Production[]> {
  const { data, error } = await supabase
    .from('productions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Production[];
}

export async function createProduction(name: string): Promise<Production> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('productions')
    .insert({ name, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Production;
}

export async function deleteProduction(id: string): Promise<void> {
  const { error } = await supabase.from('productions').delete().eq('id', id);
  if (error) throw error;
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function getEvents(productionId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('production_id', productionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function getEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Event;
}

export async function createEvent(productionId: string, name: string): Promise<Event> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('events')
    .insert({ production_id: productionId, name, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Event;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

export async function saveEventSchedule(id: string, schedule: ScheduleItem[]): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ schedule })
    .eq('id', id);
  if (error) throw error;
}
