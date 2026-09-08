import { NextResponse } from 'next/server';
import { APP_BUILD_ID } from 'src/config/version';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      buildId: APP_BUILD_ID,
      timestamp: Date.now(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
