import { GET as appsHandler } from '@/app/api/apps/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return appsHandler(req);
}
