import { progress } from '../../server/api';
import { realDeps, type Context } from '../../server/types';

export const onRequest = (ctx: Context) => progress(ctx.request, ctx.env, realDeps());
