import { z } from 'zod';

/** Shape check only. Applying a coupon is a server operation and is not done here. */
export const couponCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/),
});

export type CouponCodeInput = z.infer<typeof couponCodeSchema>;
