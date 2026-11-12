import { logout } from '../../server/api';
import type { Context } from '../../server/types';

export const onRequestPost = (ctx: Context) => logout(ctx.request, ctx.env);
