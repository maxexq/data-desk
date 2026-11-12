import { callback } from '../../../../server/api';
import { realDeps, type Context } from '../../../../server/types';

export const onRequestGet = (ctx: Context) => callback(ctx.request, ctx.env, ctx.params.provider, realDeps());
