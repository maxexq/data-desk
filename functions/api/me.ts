import { me } from '../../server/api';
import { realDeps, type Context } from '../../server/types';

export const onRequestGet = (ctx: Context) => me(ctx.request, ctx.env, realDeps());
