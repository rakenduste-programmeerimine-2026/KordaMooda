/** Quick and settled, for things that answer a tap. */
export const snappy = { type: "spring", stiffness: 480, damping: 36 } as const;

/** Slower with a little give, for things moving across the screen. */
export const soft = { type: "spring", stiffness: 260, damping: 28 } as const;
