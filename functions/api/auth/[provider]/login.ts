import { login } from '../../../../server/api';
import type { Context } from '../../../../server/types';

export const onRequestGet = (ctx: Context) => login(ctx.request, ctx.env, ctx.params.provider);
