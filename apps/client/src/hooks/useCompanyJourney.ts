import { useCallback, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';

// Single round-trip across existing root fields — no backend changes needed.
const GET_JOURNEY = gql`
  query GetCompanyJourney($companyId: ID!) {
    company(id: $companyId) {
      id
      squareStatus { connected }
      members { userId }
    }
    eventKpi(companyId: $companyId) { totalEvents }
    recipes(companyId: $companyId) { id }
    inventory(companyId: $companyId) { id }
  }
`;

export interface JourneyStep {
  key: string;
  label: string;
  description: string;
  ctaLabel: string;
  to: string;
  done: boolean;
  optional: boolean;
  skipped: boolean;
}

function readSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]); }
  catch { return new Set(); }
}

export function useCompanyJourney(companyId: string | null) {
  const skipsKey = `venview_journey_skips_${companyId}`;
  const dismissKey = `venview_journey_dismissed_${companyId}`;

  const [skips, setSkips] = useState<Set<string>>(() => readSet(skipsKey));
  const [dismissed, setDismissedState] = useState<boolean>(() => localStorage.getItem(dismissKey) === '1');

  const { data, loading } = useQuery(GET_JOURNEY, { variables: { companyId }, skip: !companyId });

  const skipStep = useCallback((key: string) => {
    setSkips(prev => {
      const next = new Set(prev).add(key);
      localStorage.setItem(skipsKey, JSON.stringify([...next]));
      return next;
    });
  }, [skipsKey]);

  const dismiss = useCallback((value = true) => {
    setDismissedState(value);
    localStorage.setItem(dismissKey, value ? '1' : '0');
  }, [dismissKey]);

  const squareConnected = !!data?.company?.squareStatus?.connected;
  const memberCount = data?.company?.members?.length ?? 0;
  const recipeCount = data?.recipes?.length ?? 0;
  const inventoryCount = data?.inventory?.length ?? 0;
  const eventCount = data?.eventKpi?.totalEvents ?? 0;

  const base: Array<Omit<JourneyStep, 'skipped'>> = [
    {
      key: 'company', label: 'Create your company', description: 'Your workspace for events, recipes, and inventory.',
      ctaLabel: 'Done', to: `/companies/${companyId}/settings`, done: true, optional: false,
    },
    {
      key: 'square', label: 'Connect Square', description: 'Auto-sync sales, locations, and labor from your POS.',
      ctaLabel: 'Connect Square', to: `/companies/${companyId}/settings`, done: squareConnected, optional: true,
    },
    {
      key: 'recipes', label: 'Add your recipes', description: 'Define ingredient costs so VenView can calculate COGS.',
      ctaLabel: 'Add recipes', to: `/companies/${companyId}/recipes`, done: recipeCount > 0, optional: true,
    },
    {
      key: 'inventory', label: 'Add your inventory', description: 'Import your product catalog to track stock and costs.',
      ctaLabel: 'Add inventory', to: `/companies/${companyId}/inventory`, done: inventoryCount > 0, optional: true,
    },
    {
      key: 'team', label: 'Invite your team', description: 'Share events, inventory, and recipes with teammates.',
      ctaLabel: 'Invite team', to: `/companies/${companyId}/settings`, done: memberCount > 1, optional: true,
    },
    {
      key: 'first-event', label: 'Create your first event', description: 'Add a market, festival, or pop-up to start tracking profit.',
      ctaLabel: 'Create event', to: `/companies/${companyId}/events/new`, done: eventCount > 0, optional: false,
    },
  ];

  const steps: JourneyStep[] = base.map(s => ({ ...s, skipped: skips.has(s.key) }));

  // Core path = company exists + first event created.
  const coreComplete = eventCount > 0;
  // The actionable steps still worth showing.
  const activeSteps = steps.filter(s => !s.done && !s.skipped);
  const doneCount = steps.filter(s => s.done).length;

  return { loading, steps, activeSteps, coreComplete, dismissed, dismiss, skipStep, doneCount, total: steps.length };
}
