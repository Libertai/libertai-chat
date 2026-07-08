import { useCallback, useLayoutEffect, useRef } from "react";

// Returns a referentially-stable function that always invokes the latest `handler`.
// Lets a parent pass event callbacks to memoized children (e.g. <Message/>) without the
// callback identity changing every render, which would defeat React.memo.
export function useStableHandler<A extends unknown[], R>(handler: (...args: A) => R): (...args: A) => R {
	const ref = useRef(handler);
	useLayoutEffect(() => {
		ref.current = handler;
	});
	return useCallback((...args: A) => ref.current(...args), []);
}
