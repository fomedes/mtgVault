"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardListItemDto } from "@/lib/api/card-dto";

interface CardListResponse {
  cards: CardListItemDto[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** Loaded results are keyed by the query that produced them, so a filter
 * change simply makes the old state irrelevant — no resets inside effects. */
interface LoadedState {
  query: string;
  cards: CardListItemDto[];
  total: number;
  hasMore: boolean;
  page: number;
  error: string | null;
}

const LOAD_ERROR = "Couldn't load cards. Check your connection and retry.";

async function fetchCardPage(
  query: string,
  page: number,
  signal: AbortSignal,
): Promise<CardListResponse> {
  const response = await fetch(`/api/cards?${query}&page=${page}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as CardListResponse;
}

/** Paged card fetching for the infinite-scroll browser (P1-08). */
export function useInfiniteCards(query: string) {
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    fetchCardPage(query, 1, controller.signal)
      .then((data) =>
        setLoaded({
          query,
          cards: data.cards,
          total: data.total,
          hasMore: data.hasMore,
          page: data.page,
          error: null,
        }),
      )
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoaded({
          query,
          cards: [],
          total: 0,
          hasMore: false,
          page: 0,
          error: LOAD_ERROR,
        });
      });
    return () => controller.abort();
  }, [query, attempt]);

  const current = loaded?.query === query ? loaded : null;

  const loadMore = useCallback(() => {
    if (!current || current.error || !current.hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    fetchCardPage(query, current.page + 1, controller.signal)
      .then((data) => {
        setLoaded((previous) =>
          previous && previous.query === query
            ? {
                ...previous,
                cards: [...previous.cards, ...data.cards],
                total: data.total,
                hasMore: data.hasMore,
                page: data.page,
              }
            : previous,
        );
        setIsLoadingMore(false);
      })
      .catch(() => {
        // Swallow: the scroll sentinel re-triggers on the next intersection.
        setIsLoadingMore(false);
      });
  }, [current, isLoadingMore, query]);

  const retry = useCallback(() => {
    setLoaded(null);
    setAttempt((value) => value + 1);
  }, []);

  return {
    cards: current?.cards ?? [],
    total: current?.total ?? 0,
    hasMore: current?.hasMore ?? false,
    isLoading: !current || isLoadingMore,
    error: current?.error ?? null,
    loadMore,
    retry,
  };
}
